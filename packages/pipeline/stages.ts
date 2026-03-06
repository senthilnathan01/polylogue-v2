import {
  ArtifactMetadata,
  ArtifactProvenance,
  ArtifactRecord,
  createEntityId,
  CriticOutput,
  ExtractorOutput,
  LengthType,
  PipelineContext,
  PrimaryVideo,
  PrimaryVideoMetadata,
  PromptKey,
  PromptVersionReference,
  Report,
  ResearchPack,
  SourceAgentOutput,
  SupportingVideoSelectionOutput,
  SynthesizerOutput,
  TranscriptSegment,
  VideoSource,
  WriterOutput,
} from '@/packages/core';
import {
  buildCriticArtifactCacheKey,
  buildPrimaryVideoCacheKey,
  buildReportArtifactCacheKey,
  buildSourceSelectionArtifactCacheKey,
  buildStageCacheKey,
  buildSupportingTranscriptSignature,
  buildSupportingVideoSelectionCacheKey,
  buildSynthesisArtifactCacheKey,
  buildTopicMapCacheKey,
  buildTranscriptArtifactCacheKey,
  getSourceSearchCacheWindowMs,
  hashArtifactContent,
  hashTranscriptSegments,
  isArtifactFresh,
} from '@/packages/core/artifacts';
import { RepositoryBundle } from '@/packages/core/repositories';
import type { ResearchPipelineDependencies } from '@/packages/pipeline/run-research-pipeline';

import { CriticAgent } from './agents/critic-agent';
import { ExtractorAgent } from './agents/extractor-agent';
import { SourceAgent } from './agents/source-agent';
import { SynthesizerAgent } from './agents/synthesizer-agent';
import { WriterAgent } from './agents/writer-agent';

interface TranscriptArtifactPayload {
  video_id: string;
  transcript: string;
  transcript_segments: TranscriptSegment[];
  transcript_word_count: number;
  source?: VideoSource;
}

interface ReportArtifactPayload {
  title: string;
  report_text: string;
  thinking_text: string;
}

type PrimaryVideoMetadataArtifactPayload = PrimaryVideoMetadata & {
  canonical_video_id: string;
};

export type LoadedArtifact<T> = ArtifactRecord<T> & { content: T };

function now(): string {
  return new Date().toISOString();
}

function getPromptVersion(
  context: PipelineContext,
  key: PromptKey,
): PromptVersionReference | undefined {
  return context.prompt_versions.find((item) => item.key === key);
}

function hasArtifactContent<T>(
  artifact: ArtifactRecord<T> | null,
): artifact is LoadedArtifact<T> {
  return Boolean(artifact?.content);
}

function requireArtifactContent<T>(
  artifact: ArtifactRecord<T> | null,
  label: string,
): LoadedArtifact<T> {
  if (!hasArtifactContent(artifact)) {
    throw new Error(`${label} artifact was missing its persisted content.`);
  }

  return artifact;
}

function buildPrimaryVideoFromArtifacts(
  metadata: PrimaryVideoMetadataArtifactPayload,
  transcript: TranscriptArtifactPayload,
): PrimaryVideo {
  const durationFromTranscript =
    transcript.transcript_segments[transcript.transcript_segments.length - 1]?.end ?? 0;

  return {
    video_id: metadata.video_id,
    title: metadata.title,
    url: metadata.url,
    channel: metadata.channel,
    view_count: metadata.view_count,
    published_at: metadata.published_at,
    duration_sec:
      metadata.duration_sec && metadata.duration_sec > 0 ? metadata.duration_sec : durationFromTranscript,
    description: metadata.description,
    transcript: transcript.transcript,
    transcript_segments: transcript.transcript_segments,
    transcript_word_count: transcript.transcript_word_count,
  };
}

function buildArtifactMetadata(
  input: ArtifactMetadata,
  content: unknown,
): ArtifactMetadata {
  return {
    ...input,
    content_hash: input.content_hash ?? hashArtifactContent(content),
  };
}

async function saveArtifact<T>(
  repositories: RepositoryBundle,
  context: PipelineContext,
  input: {
    kind: ArtifactRecord<T>['kind'];
    cacheKey: string;
    content: T;
    promptVersion?: PromptVersionReference;
    metadata?: ArtifactMetadata;
    provenance: ArtifactProvenance;
  },
): Promise<ArtifactRecord<T>> {
  return repositories.artifacts.save<T>({
    id: createEntityId('artifact'),
    kind: input.kind,
    job_id: context.job_id,
    research_pack_id: context.research_pack_id,
    prompt_version: input.promptVersion,
    cache_key: input.cacheKey,
    metadata: buildArtifactMetadata(input.metadata ?? {}, input.content),
    provenance: input.provenance,
    content: input.content,
    created_at: now(),
    updated_at: now(),
  });
}

export async function ingestPrimaryVideoStage(
  context: PipelineContext,
  deps: ResearchPipelineDependencies,
): Promise<LoadedArtifact<PrimaryVideoMetadataArtifactPayload> | null> {
  const cacheKey = buildPrimaryVideoCacheKey(context.canonical_video_id);
  const cachedArtifact =
    await deps.repositories.artifacts.findLatestByCacheKey<PrimaryVideoMetadataArtifactPayload>(cacheKey);

  if (hasArtifactContent(cachedArtifact)) {
    return cachedArtifact;
  }

  const details = await deps.videoProvider.getVideoDetails(context.canonical_video_id);
  if (!details) {
    return null;
  }

  const primaryVideoMetadata: PrimaryVideoMetadataArtifactPayload = {
    canonical_video_id: context.canonical_video_id,
    video_id: details.video_id,
    title: details.title,
    url: details.url,
    channel: details.channel,
    view_count: details.view_count,
    published_at: details.published_at,
    duration_sec: details.duration_sec ?? 0,
    description: details.description,
    transcript_word_count: 0,
  };

  return requireArtifactContent(
    await saveArtifact(deps.repositories, context, {
      kind: 'primary_video_metadata',
      cacheKey,
      content: primaryVideoMetadata,
    metadata: {
      canonical_video_id: context.canonical_video_id,
      video_id: details.video_id,
    },
    provenance: {
      stage: 'ingest_primary_video',
      input_signature: cacheKey,
      upstream_artifact_ids: [],
      video_provider: deps.videoProvider.provider_name,
    },
    }),
    'primary video metadata',
  );
}

export async function fetchPrimaryTranscriptStage(
  context: PipelineContext,
  deps: ResearchPipelineDependencies,
  metadataArtifact: LoadedArtifact<PrimaryVideoMetadataArtifactPayload>,
): Promise<{
  primaryVideo: PrimaryVideo;
  transcriptArtifact: LoadedArtifact<TranscriptArtifactPayload>;
}> {
  const transcriptCacheKey = buildTranscriptArtifactCacheKey(metadataArtifact.content.video_id);
  const cachedTranscript =
    await deps.repositories.artifacts.findLatestByCacheKey<TranscriptArtifactPayload>(transcriptCacheKey);

  let transcriptArtifact = hasArtifactContent(cachedTranscript) ? cachedTranscript : null;

  if (!transcriptArtifact) {
    const segments = await deps.transcriptProvider.getTranscriptSegments(metadataArtifact.content.video_id);

    if (!segments || segments.length === 0) {
      throw new Error(
        'Could not fetch a transcript for that YouTube video. Try another URL with available captions.',
      );
    }

    const transcript = segments.map((segment) => segment.text).join(' ');
    transcriptArtifact = requireArtifactContent(
      await saveArtifact(deps.repositories, context, {
        kind: 'primary_transcript',
        cacheKey: transcriptCacheKey,
        content: {
          video_id: metadataArtifact.content.video_id,
          transcript,
          transcript_segments: segments,
          transcript_word_count: transcript.split(/\s+/).filter(Boolean).length,
        },
        metadata: {
          canonical_video_id: context.canonical_video_id,
          video_id: metadataArtifact.content.video_id,
          transcript_hash: hashTranscriptSegments(segments),
          transcript_word_count: transcript.split(/\s+/).filter(Boolean).length,
        },
        provenance: {
          stage: 'fetch_primary_transcript',
          input_signature: transcriptCacheKey,
          upstream_artifact_ids: [metadataArtifact.id],
          transcript_provider: deps.transcriptProvider.provider_name,
        },
      }),
      'primary transcript',
    );
  }

  return {
    transcriptArtifact,
    primaryVideo: buildPrimaryVideoFromArtifacts(metadataArtifact.content, transcriptArtifact.content),
  };
}

export async function extractTopicsStage(
  context: PipelineContext,
  deps: ResearchPipelineDependencies,
  primaryVideo: PrimaryVideo,
  transcriptArtifact: LoadedArtifact<TranscriptArtifactPayload>,
): Promise<LoadedArtifact<ExtractorOutput>> {
  const promptVersion = getPromptVersion(context, 'extractor');
  const transcriptHash =
    transcriptArtifact.metadata?.transcript_hash ?? hashTranscriptSegments(primaryVideo.transcript_segments);
  const cacheKey = buildTopicMapCacheKey(transcriptHash, promptVersion);
  const cachedArtifact = await deps.repositories.artifacts.findLatestByCacheKey<ExtractorOutput>(cacheKey);

  if (hasArtifactContent(cachedArtifact)) {
    return cachedArtifact;
  }

  const extractor = new ExtractorAgent(deps.llm);
  const output = await extractor.run(primaryVideo);

  return requireArtifactContent(
    await saveArtifact(deps.repositories, context, {
      kind: 'topic_map',
      cacheKey,
      content: output,
      promptVersion,
      metadata: {
        canonical_video_id: context.canonical_video_id,
        video_id: primaryVideo.video_id,
        transcript_hash: transcriptHash,
        topic_names: output.top_topics.map((topic) => topic.name),
      },
      provenance: {
        stage: 'extract_topics',
        input_signature: cacheKey,
        upstream_artifact_ids: [transcriptArtifact.id],
        llm_model: deps.llm.model_name,
      },
    }),
    'topic map',
  );
}

export async function searchSupportingVideosStage(
  context: PipelineContext,
  deps: ResearchPipelineDependencies,
  primaryVideo: PrimaryVideo,
  topicMapArtifact: LoadedArtifact<ExtractorOutput>,
): Promise<LoadedArtifact<SupportingVideoSelectionOutput>> {
  const topicMapHash = topicMapArtifact.metadata?.content_hash ?? hashArtifactContent(topicMapArtifact.content);
  const cacheKey = buildSupportingVideoSelectionCacheKey(context.canonical_video_id, topicMapHash);
  const cachedArtifact =
    await deps.repositories.artifacts.findLatestByCacheKey<SupportingVideoSelectionOutput>(cacheKey);

  if (hasArtifactContent(cachedArtifact) && isArtifactFresh(cachedArtifact, getSourceSearchCacheWindowMs())) {
    return cachedArtifact;
  }

  const sourceAgent = new SourceAgent(deps.llm, deps.videoProvider, deps.transcriptProvider);
  const output = await sourceAgent.selectSupportingVideos(primaryVideo, topicMapArtifact.content.top_topics);

  return requireArtifactContent(
    await saveArtifact(deps.repositories, context, {
      kind: 'supporting_video_selection',
      cacheKey,
      content: output,
      metadata: {
        canonical_video_id: context.canonical_video_id,
        video_id: primaryVideo.video_id,
        topic_names: output.selections.map((selection) => selection.topic.name),
        supporting_video_ids: output.selections
          .map((selection) => selection.source?.video_id)
          .filter((videoId): videoId is string => Boolean(videoId)),
        source_count: output.selections.filter((selection) => Boolean(selection.source)).length,
      },
      provenance: {
        stage: 'search_supporting_videos',
        input_signature: cacheKey,
        upstream_artifact_ids: [topicMapArtifact.id],
        video_provider: deps.videoProvider.provider_name,
        transcript_provider: deps.transcriptProvider.provider_name,
        freshness_window_hours: getSourceSearchCacheWindowMs() / (60 * 60 * 1000),
      },
    }),
    'supporting video selection',
  );
}

export async function fetchSupportingTranscriptsStage(
  context: PipelineContext,
  deps: ResearchPipelineDependencies,
  selectionArtifact: LoadedArtifact<SupportingVideoSelectionOutput>,
): Promise<Array<LoadedArtifact<TranscriptArtifactPayload>>> {
  const artifacts: Array<LoadedArtifact<TranscriptArtifactPayload>> = [];

  for (const selection of selectionArtifact.content.selections) {
    if (!selection.source) {
      continue;
    }

    const transcriptCacheKey = buildTranscriptArtifactCacheKey(selection.source.video_id);
    const cachedTranscript =
      await deps.repositories.artifacts.findLatestByCacheKey<TranscriptArtifactPayload>(transcriptCacheKey);

    if (hasArtifactContent(cachedTranscript)) {
      artifacts.push(cachedTranscript);
      continue;
    }

    const segments = await deps.transcriptProvider.getTranscriptSegments(selection.source.video_id);

    if (!segments || segments.length === 0) {
      continue;
    }

    const transcript = segments.map((segment) => segment.text).join(' ');
    artifacts.push(
      requireArtifactContent(
        await saveArtifact(deps.repositories, context, {
          kind: 'supporting_transcript',
          cacheKey: transcriptCacheKey,
          content: {
            video_id: selection.source.video_id,
            transcript,
            transcript_segments: segments,
            transcript_word_count: transcript.split(/\s+/).filter(Boolean).length,
            source: selection.source,
          },
          metadata: {
            canonical_video_id: context.canonical_video_id,
            video_id: selection.source.video_id,
            transcript_hash: hashTranscriptSegments(segments),
            transcript_word_count: transcript.split(/\s+/).filter(Boolean).length,
          },
          provenance: {
            stage: 'fetch_supporting_transcripts',
            input_signature: transcriptCacheKey,
            upstream_artifact_ids: [selectionArtifact.id],
            transcript_provider: deps.transcriptProvider.provider_name,
          },
        }),
        'supporting transcript',
      ),
    );
  }

  return artifacts;
}

export async function buildResearchPackStage(
  context: PipelineContext,
  deps: ResearchPipelineDependencies,
  primaryVideo: PrimaryVideo,
  topicMapArtifact: LoadedArtifact<ExtractorOutput>,
  selectionArtifact: LoadedArtifact<SupportingVideoSelectionOutput>,
  supportingTranscriptArtifacts: Array<LoadedArtifact<TranscriptArtifactPayload>>,
): Promise<{
  researchPack: ResearchPack;
  sourceSelectionArtifact: LoadedArtifact<SourceAgentOutput>;
}> {
  const promptVersion = getPromptVersion(context, 'source_analysis');
  const topicMapHash = topicMapArtifact.metadata?.content_hash ?? hashArtifactContent(topicMapArtifact.content);
  const transcriptSignature = buildSupportingTranscriptSignature(supportingTranscriptArtifacts);
  const cacheKey = buildSourceSelectionArtifactCacheKey(
    context.canonical_video_id,
    topicMapHash,
    transcriptSignature,
    promptVersion,
  );
  const cachedArtifact = await deps.repositories.artifacts.findLatestByCacheKey<SourceAgentOutput>(cacheKey);

  let sourceSelectionArtifact = hasArtifactContent(cachedArtifact) ? cachedArtifact : null;

  if (!sourceSelectionArtifact) {
    const sourceAgent = new SourceAgent(deps.llm, deps.videoProvider, deps.transcriptProvider);
    const transcriptsByVideoId = new Map<string, TranscriptSegment[]>(
      supportingTranscriptArtifacts.map((artifact) => [
        artifact.content.video_id,
        artifact.content.transcript_segments,
      ]),
    );
    const output = await sourceAgent.analyzeSelections(
      primaryVideo,
      selectionArtifact.content,
      transcriptsByVideoId,
    );

    sourceSelectionArtifact = requireArtifactContent(
      await saveArtifact(deps.repositories, context, {
        kind: 'source_selection',
        cacheKey,
        content: output,
        promptVersion,
        metadata: {
          canonical_video_id: context.canonical_video_id,
          video_id: primaryVideo.video_id,
          topic_names: output.topic_research.map((item) => item.topic.name),
          supporting_video_ids: output.sources.map((source) => source.video_id),
          source_count: output.sources.length,
        },
        provenance: {
          stage: 'build_research_pack',
          input_signature: cacheKey,
          upstream_artifact_ids: [
            topicMapArtifact.id,
            selectionArtifact.id,
            ...supportingTranscriptArtifacts.map((artifact) => artifact.id),
          ],
          llm_model: deps.llm.model_name,
        },
      }),
      'source selection',
    );
  }

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
    supporting_transcript_artifact_ids: supportingTranscriptArtifacts.map((artifact) => artifact.id),
    topic_map_artifact_id: topicMapArtifact.id,
    source_selection_artifact_id: sourceSelectionArtifact.id,
    synthesis_artifact_id: context.artifacts.synthesis_artifact_id,
    critic_artifact_id: context.artifacts.critic_artifact_id,
    provenance: {
      transcript_provider: deps.transcriptProvider.provider_name,
      video_provider: deps.videoProvider.provider_name,
      llm_model: deps.llm.model_name,
    },
    created_at: now(),
    updated_at: now(),
  };

  return {
    researchPack: await deps.repositories.researchPacks.save(researchPack),
    sourceSelectionArtifact,
  };
}

export async function renderReportStage(
  context: PipelineContext,
  deps: ResearchPipelineDependencies,
  primaryVideo: PrimaryVideo,
  extractorOutput: ExtractorOutput,
  sourceSelectionArtifact: LoadedArtifact<SourceAgentOutput>,
): Promise<{
  synthesisArtifact: LoadedArtifact<SynthesizerOutput>;
  criticArtifact: LoadedArtifact<CriticOutput>;
  reportArtifact: LoadedArtifact<ReportArtifactPayload>;
  report: Report;
}> {
  const synthesizerPrompt = getPromptVersion(context, 'synthesizer');
  const sourceSelectionHash =
    sourceSelectionArtifact.metadata?.content_hash ?? hashArtifactContent(sourceSelectionArtifact.content);
  const synthesizerCacheKey = buildSynthesisArtifactCacheKey(
    context.canonical_video_id,
    sourceSelectionHash,
    context.request.length_type,
    synthesizerPrompt,
  );
  const cachedSynthesis =
    await deps.repositories.artifacts.findLatestByCacheKey<SynthesizerOutput>(synthesizerCacheKey);
  const synthesizer = new SynthesizerAgent(deps.llm);
  const synthesisArtifact =
    hasArtifactContent(cachedSynthesis)
      ? cachedSynthesis
      : requireArtifactContent(
          await saveArtifact(deps.repositories, context, {
            kind: 'synthesis_plan',
            cacheKey: synthesizerCacheKey,
            content: await synthesizer.run(
              primaryVideo,
              extractorOutput,
              sourceSelectionArtifact.content.topic_research,
              context.request.length_type,
            ),
            promptVersion: synthesizerPrompt,
            metadata: {
              canonical_video_id: context.canonical_video_id,
              video_id: primaryVideo.video_id,
              report_length: context.request.length_type,
              supporting_video_ids: sourceSelectionArtifact.content.sources.map((source) => source.video_id),
            },
            provenance: {
              stage: 'render_report',
              input_signature: synthesizerCacheKey,
              upstream_artifact_ids: [sourceSelectionArtifact.id],
              llm_model: deps.llm.model_name,
            },
          }),
          'synthesis plan',
        );

  const criticPrompt = getPromptVersion(context, 'critic');
  const synthesisHash =
    synthesisArtifact.metadata?.content_hash ?? hashArtifactContent(synthesisArtifact.content);
  const criticCacheKey = buildCriticArtifactCacheKey(
    context.canonical_video_id,
    synthesisHash,
    criticPrompt,
  );
  const cachedCritic = await deps.repositories.artifacts.findLatestByCacheKey<CriticOutput>(criticCacheKey);
  const critic = new CriticAgent(deps.llm);
  const criticArtifact =
    hasArtifactContent(cachedCritic)
      ? cachedCritic
      : requireArtifactContent(
          await saveArtifact(deps.repositories, context, {
            kind: 'critic_notes',
            cacheKey: criticCacheKey,
            content: await critic.run(
              primaryVideo,
              sourceSelectionArtifact.content.topic_research,
              synthesisArtifact.content,
            ),
            promptVersion: criticPrompt,
            metadata: {
              canonical_video_id: context.canonical_video_id,
              video_id: primaryVideo.video_id,
              report_length: context.request.length_type,
            },
            provenance: {
              stage: 'render_report',
              input_signature: criticCacheKey,
              upstream_artifact_ids: [sourceSelectionArtifact.id, synthesisArtifact.id],
              llm_model: deps.llm.model_name,
            },
          }),
          'critic notes',
        );

  const writerPrompt = getPromptVersion(context, 'writer');
  const criticHash = criticArtifact.metadata?.content_hash ?? hashArtifactContent(criticArtifact.content);
  const reportCacheKey = buildReportArtifactCacheKey(
    context.canonical_video_id,
    synthesisHash,
    criticHash,
    context.request.length_type,
    writerPrompt,
  );
  const cachedReport =
    await deps.repositories.artifacts.findLatestByCacheKey<ReportArtifactPayload>(reportCacheKey);
  const writer = new WriterAgent(deps.llm);
  const reportArtifact =
    hasArtifactContent(cachedReport)
      ? cachedReport
      : requireArtifactContent(
          await (async () => {
            const writerOutput: WriterOutput = await writer.run(
              primaryVideo,
              extractorOutput,
              sourceSelectionArtifact.content.topic_research,
              synthesisArtifact.content,
              criticArtifact.content,
              context.request.length_type,
            );

            return saveArtifact(deps.repositories, context, {
              kind: 'report_markdown',
              cacheKey: reportCacheKey,
              content: {
                title: writerOutput.title,
                report_text: writerOutput.report_text,
                thinking_text: writerOutput.thinking_text,
              },
              promptVersion: writerPrompt,
              metadata: {
                canonical_video_id: context.canonical_video_id,
                video_id: primaryVideo.video_id,
                report_length: context.request.length_type,
                supporting_video_ids: sourceSelectionArtifact.content.sources.map((source) => source.video_id),
              },
              provenance: {
                stage: 'render_report',
                input_signature: reportCacheKey,
                upstream_artifact_ids: [
                  sourceSelectionArtifact.id,
                  synthesisArtifact.id,
                  criticArtifact.id,
                ],
                llm_model: deps.llm.model_name,
              },
            });
          })(),
          'report markdown',
        );

  const report: Report = {
    id: context.report_id,
    job_id: context.job_id,
    research_pack_id: context.research_pack_id,
    canonical_video_id: context.canonical_video_id,
    idempotency_key: context.idempotency_key,
    prompt_bundle_id: context.prompt_bundle_id,
    prompt_versions: context.prompt_versions,
    youtube_url: context.request.youtube_url,
    length_type: context.request.length_type as LengthType,
    title: reportArtifact.content.title,
    report_text: reportArtifact.content.report_text,
    thinking_text: reportArtifact.content.thinking_text,
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
    topics: extractorOutput.top_topics,
    sources: sourceSelectionArtifact.content.sources,
    topic_research: sourceSelectionArtifact.content.topic_research,
    synthesis: synthesisArtifact.content,
    created_at: now(),
    updated_at: now(),
    word_count: reportArtifact.content.report_text.split(/\s+/).filter(Boolean).length,
  };

  return {
    synthesisArtifact,
    criticArtifact,
    reportArtifact,
    report,
  };
}

export async function buildExportsStage(
  context: PipelineContext,
): Promise<{
  cache_key: string;
  status: 'deferred';
}> {
  return {
    cache_key: buildStageCacheKey('build_exports', context.research_pack_id),
    status: 'deferred',
  };
}
