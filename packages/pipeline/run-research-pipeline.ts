import {
  ACTIVE_PROMPT_VERSIONS,
  ArtifactRecord,
  buildIdempotencyKey,
  buildPromptBundleId,
  createEntityId,
  createPromptVersionReferences,
  Job,
  PipelineContext,
  PrimaryVideo,
  Report,
  ResearchPack,
  SourceAgentOutput,
  StreamEvent,
  SynthesizerOutput,
} from '@/packages/core';
import { RepositoryBundle } from '@/packages/core/repositories';
import { TranscriptProvider, VideoProvider, LLMProvider } from '@/packages/core/providers';
import { getTranscriptArtifactCacheKey } from '@/lib/providers/cached-transcript-provider';

import { CriticAgent } from './agents/critic-agent';
import { ExtractorAgent } from './agents/extractor-agent';
import { SourceAgent } from './agents/source-agent';
import { SynthesizerAgent } from './agents/synthesizer-agent';
import { WriterAgent } from './agents/writer-agent';

export interface ResearchPipelineDependencies {
  llm: LLMProvider;
  transcriptProvider: TranscriptProvider;
  videoProvider: VideoProvider;
  repositories: RepositoryBundle;
}

async function buildPrimaryVideo(
  youtubeUrl: string,
  videoProvider: VideoProvider,
  transcriptProvider: TranscriptProvider,
): Promise<PrimaryVideo | null> {
  const videoId = videoProvider.extractVideoId(youtubeUrl);

  if (!videoId) {
    return null;
  }

  const [details, transcriptSegments] = await Promise.all([
    videoProvider.getVideoDetails(videoId),
    transcriptProvider.getTranscriptSegments(videoId),
  ]);

  if (!details || !transcriptSegments || transcriptSegments.length === 0) {
    return null;
  }

  const transcript = transcriptSegments.map((segment) => segment.text).join(' ');
  const durationFromTranscript = transcriptSegments[transcriptSegments.length - 1]?.end ?? 0;

  return {
    video_id: details.video_id,
    title: details.title,
    url: details.url,
    channel: details.channel,
    view_count: details.view_count,
    published_at: details.published_at,
    duration_sec: details.duration_sec && details.duration_sec > 0 ? details.duration_sec : durationFromTranscript,
    description: details.description,
    transcript,
    transcript_segments: transcriptSegments,
    transcript_word_count: transcript.split(/\s+/).filter(Boolean).length,
  };
}

function createInitialContext(input: {
  youtubeUrl: string;
  lengthType: Report['length_type'];
  canonicalVideoId: string;
  llmModel: string;
}): PipelineContext {
  const promptBundleId = buildPromptBundleId(ACTIVE_PROMPT_VERSIONS);

  return {
    request: {
      youtube_url: input.youtubeUrl,
      length_type: input.lengthType,
    },
    canonical_video_id: input.canonicalVideoId,
    idempotency_key: buildIdempotencyKey({
      canonical_video_id: input.canonicalVideoId,
      length_type: input.lengthType,
      prompt_bundle_id: promptBundleId,
    }),
    prompt_bundle_id: promptBundleId,
    prompt_versions: createPromptVersionReferences(ACTIVE_PROMPT_VERSIONS, input.llmModel),
    job_id: createEntityId('job'),
    research_pack_id: createEntityId('research_pack'),
    report_id: createEntityId('report'),
    artifacts: {
      supporting_transcript_artifact_ids: [],
    },
  };
}

export async function* runResearchPipeline(
  youtubeUrl: string,
  lengthType: Report['length_type'],
  deps: ResearchPipelineDependencies,
): AsyncGenerator<StreamEvent> {
  const canonicalVideoId = deps.videoProvider.extractVideoId(youtubeUrl);

  if (!canonicalVideoId) {
    yield {
      stage: 'failed',
      text: 'The YouTube URL did not contain a canonical video ID.',
    };
    return;
  }

  const extractor = new ExtractorAgent(deps.llm);
  const sourceAgent = new SourceAgent(deps.llm, deps.videoProvider, deps.transcriptProvider);
  const synthesizer = new SynthesizerAgent(deps.llm);
  const critic = new CriticAgent(deps.llm);
  const writer = new WriterAgent(deps.llm);

  const context = createInitialContext({
    youtubeUrl,
    lengthType,
    canonicalVideoId,
    llmModel: deps.llm.model_name,
  });

  let job: Job = await deps.repositories.jobs.create({
    id: context.job_id,
    youtube_url: context.request.youtube_url,
    canonical_video_id: context.canonical_video_id,
    length_type: context.request.length_type,
    status: 'running',
    idempotency_key: context.idempotency_key,
    prompt_bundle_id: context.prompt_bundle_id,
    prompt_versions: context.prompt_versions,
    research_pack_id: context.research_pack_id,
    report_id: context.report_id,
    error_message: undefined,
  });

  let eventSequence = 0;

  const emit = async (event: StreamEvent) => {
    eventSequence += 1;
    await deps.repositories.jobEvents.append({
      id: createEntityId('job_event'),
      job_id: job.id,
      sequence: eventSequence,
      stage: event.stage,
      text: event.text,
      data: event.data,
    });
    return event;
  };

  const saveArtifact = async <T,>(
    kind: ArtifactRecord<T>['kind'],
    content: T,
    promptKey?: ArtifactRecord<T>['prompt_version'],
  ): Promise<string> => {
    const artifact = await deps.repositories.artifacts.save<T>({
      id: createEntityId('artifact'),
      kind,
      job_id: context.job_id,
      research_pack_id: context.research_pack_id,
      prompt_version: promptKey,
      cache_key: `${kind}:${context.idempotency_key}`,
      content,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return artifact.id;
  };

  try {
    yield await emit({ stage: 'validating_input', text: 'Validating the YouTube link...' });

    yield await emit({
      stage: 'transcript_fetched',
      text: 'Fetching the main video transcript...',
    });

    const primaryVideo = await buildPrimaryVideo(
      youtubeUrl,
      deps.videoProvider,
      deps.transcriptProvider,
    );

    if (!primaryVideo) {
      job = await deps.repositories.jobs.update({
        ...job,
        status: 'failed',
        error_message:
          'Could not fetch a transcript for that YouTube video. Try another URL with available captions.',
      });

      yield await emit({
        stage: 'failed',
        text: job.error_message,
      });
      return;
    }

    context.artifacts.primary_transcript_artifact_id =
      (
        await deps.repositories.artifacts.findLatestByCacheKey(
          getTranscriptArtifactCacheKey(primaryVideo.video_id),
        )
      )?.id ??
      (await saveArtifact(
        'transcript',
        {
          video_id: primaryVideo.video_id,
          transcript: primaryVideo.transcript,
          transcript_segments: primaryVideo.transcript_segments,
          transcript_word_count: primaryVideo.transcript_word_count,
        },
      ));

    yield await emit({
      stage: 'transcript_fetched',
      data: {
        title: primaryVideo.title,
        words: primaryVideo.transcript_word_count,
        duration_sec: primaryVideo.duration_sec,
        channel: primaryVideo.channel,
      },
    });

    yield await emit({
      stage: 'extracting_topics',
      text: 'Mapping the main themes from the primary video...',
    });
    const extractorOutput = await extractor.run(primaryVideo);
    context.artifacts.topic_map_artifact_id = await saveArtifact(
      'topic_map',
      extractorOutput,
      context.prompt_versions.find((item) => item.key === 'extractor'),
    );

    yield await emit({
      stage: 'topics_found',
      data: {
        topics: extractorOutput.top_topics,
        summary: extractorOutput.overall_summary,
      },
    });

    yield await emit({
      stage: 'fetching_sources',
      text: 'Finding one strong transcript-backed support video for each topic...',
    });
    const sourceOutput = await sourceAgent.run(primaryVideo, extractorOutput.top_topics);
    context.artifacts.source_selection_artifact_id = await saveArtifact<SourceAgentOutput>(
      'source_selection',
      sourceOutput,
      context.prompt_versions.find((item) => item.key === 'source_analysis'),
    );

    context.artifacts.supporting_transcript_artifact_ids = await persistSupportingTranscripts({
      sourceOutput,
      context,
      repositories: deps.repositories,
    });

    yield await emit({
      stage: 'sources_found',
      data: {
        sources: sourceOutput.sources,
        topic_research: sourceOutput.topic_research,
      },
    });

    yield await emit({ stage: 'synthesizing', text: 'Building the long-form report plan...' });
    const synthesizerOutput = await synthesizer.run(
      primaryVideo,
      extractorOutput,
      sourceOutput.topic_research,
      lengthType,
    );
    context.artifacts.synthesis_artifact_id = await saveArtifact<SynthesizerOutput>(
      'synthesis_plan',
      synthesizerOutput,
      context.prompt_versions.find((item) => item.key === 'synthesizer'),
    );

    yield await emit({
      stage: 'critiquing',
      text: 'Checking the plan for missing nuance and weak sections...',
    });
    const criticOutput = await critic.run(
      primaryVideo,
      sourceOutput.topic_research,
      synthesizerOutput,
    );
    context.artifacts.critic_artifact_id = await saveArtifact(
      'critic_notes',
      criticOutput,
      context.prompt_versions.find((item) => item.key === 'critic'),
    );

    yield await emit({ stage: 'generating_report', text: 'Writing the final report...' });
    const writerOutput = await writer.run(
      primaryVideo,
      extractorOutput,
      sourceOutput.topic_research,
      synthesizerOutput,
      criticOutput,
      lengthType,
    );

    let fullReportText = '';
    for await (const chunk of writer.streamReport(writerOutput.report_text)) {
      fullReportText += chunk;
      yield await emit({ stage: 'token', text: chunk });
    }

    context.artifacts.report_artifact_id = await saveArtifact(
      'report_markdown',
      {
        title: writerOutput.title,
        report_text: fullReportText,
        thinking_text: writerOutput.thinking_text,
      },
      context.prompt_versions.find((item) => item.key === 'writer'),
    );

    const researchPack: ResearchPack = {
      id: context.research_pack_id,
      job_id: context.job_id,
      canonical_video_id: context.canonical_video_id,
      youtube_url: context.request.youtube_url,
      length_type: context.request.length_type,
      prompt_bundle_id: context.prompt_bundle_id,
      prompt_versions: context.prompt_versions,
      primary_video: {
        video_id: primaryVideo.video_id,
        title: primaryVideo.title,
        url: primaryVideo.url,
        channel: primaryVideo.channel,
        view_count: primaryVideo.view_count,
        published_at: primaryVideo.published_at,
        duration_sec: primaryVideo.duration_sec,
        description: primaryVideo.description,
        transcript_word_count: primaryVideo.transcript_word_count,
      },
      primary_transcript_artifact_id: context.artifacts.primary_transcript_artifact_id!,
      supporting_transcript_artifact_ids: context.artifacts.supporting_transcript_artifact_ids,
      topic_map_artifact_id: context.artifacts.topic_map_artifact_id!,
      source_selection_artifact_id: context.artifacts.source_selection_artifact_id!,
      synthesis_artifact_id: context.artifacts.synthesis_artifact_id,
      critic_artifact_id: context.artifacts.critic_artifact_id,
      provenance: {
        transcript_provider: deps.transcriptProvider.provider_name,
        video_provider: deps.videoProvider.provider_name,
        llm_model: deps.llm.model_name,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await deps.repositories.researchPacks.save(researchPack);

    const report: Report = {
      id: context.report_id,
      job_id: context.job_id,
      research_pack_id: context.research_pack_id,
      canonical_video_id: context.canonical_video_id,
      idempotency_key: context.idempotency_key,
      prompt_bundle_id: context.prompt_bundle_id,
      prompt_versions: context.prompt_versions,
      youtube_url: youtubeUrl,
      length_type: lengthType,
      title: writerOutput.title,
      report_text: fullReportText,
      thinking_text: writerOutput.thinking_text,
      primary_video: researchPack.primary_video,
      sources: sourceOutput.sources,
      topics: extractorOutput.top_topics,
      topic_research: sourceOutput.topic_research,
      synthesis: synthesizerOutput,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      word_count: fullReportText.split(/\s+/).filter(Boolean).length,
    };
    const savedReport = await deps.repositories.reports.save(report);

    job = await deps.repositories.jobs.update({
      ...job,
      status: 'completed',
      report_id: savedReport.id,
      updated_at: new Date().toISOString(),
    });

    yield await emit({
      stage: 'metadata',
      data: {
        report_id: savedReport.id,
        title: savedReport.title,
        thinking_text: savedReport.thinking_text,
        primary_video: savedReport.primary_video,
        topics: savedReport.topics,
        sources: savedReport.sources,
        topic_research: savedReport.topic_research,
        word_count: savedReport.word_count,
      },
    });

    yield await emit({ stage: 'done' });
  } catch (error) {
    job = await deps.repositories.jobs.update({
      ...job,
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Internal server error',
      updated_at: new Date().toISOString(),
    });

    yield await emit({
      stage: 'failed',
      text: job.error_message,
    });
  }
}

async function persistSupportingTranscripts(input: {
  sourceOutput: SourceAgentOutput;
  context: PipelineContext;
  repositories: RepositoryBundle;
}): Promise<string[]> {
  const artifactIds: string[] = [];

  for (const source of input.sourceOutput.sources) {
    const existing =
      await input.repositories.artifacts.findLatestByCacheKey(
        getTranscriptArtifactCacheKey(source.video_id),
      );

    if (existing) {
      artifactIds.push(existing.id);
      continue;
    }

    artifactIds.push(
      (
        await input.repositories.artifacts.save({
          id: createEntityId('artifact'),
          kind: 'transcript',
          job_id: input.context.job_id,
          research_pack_id: input.context.research_pack_id,
          cache_key: getTranscriptArtifactCacheKey(source.video_id),
          content: {
            source,
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      ).id,
    );
  }

  return artifactIds;
}
