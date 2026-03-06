import {
  createEntityId,
  Job,
  PipelineContext,
  StreamEvent,
} from '@/packages/core';
import { RepositoryBundle } from '@/packages/core/repositories';
import { LLMProvider, TranscriptProvider, VideoProvider } from '@/packages/core/providers';

import { WriterAgent } from './agents/writer-agent';
import {
  buildExportsStage,
  buildResearchPackStage,
  extractTopicsStage,
  fetchPrimaryTranscriptStage,
  fetchSupportingTranscriptsStage,
  ingestPrimaryVideoStage,
  renderReportStage,
  searchSupportingVideosStage,
} from './stages';

export interface ResearchPipelineDependencies {
  llm: LLMProvider;
  transcriptProvider: TranscriptProvider;
  videoProvider: VideoProvider;
  repositories: RepositoryBundle;
}

function createInitialContext(input: {
  job: Job;
}): PipelineContext {
  return {
    request: {
      youtube_url: input.job.youtube_url,
      length_type: input.job.length_type,
    },
    canonical_video_id: input.job.canonical_video_id,
    idempotency_key: input.job.idempotency_key,
    prompt_bundle_id: input.job.prompt_bundle_id,
    prompt_versions: input.job.prompt_versions,
    job_id: input.job.id,
    research_pack_id: input.job.research_pack_id,
    report_id: input.job.report_id ?? createEntityId('report'),
    artifacts: {
      supporting_transcript_artifact_ids: [],
    },
  };
}

export async function* runResearchJob(
  job: Job,
  deps: ResearchPipelineDependencies,
): AsyncGenerator<StreamEvent> {
  const context = createInitialContext({
    job,
  });
  let currentJob = job;
  let researchPackCreatedAt: string | undefined;
  const existingEvents = await deps.repositories.jobEvents.listByJobId(job.id);
  let eventSequence = existingEvents[existingEvents.length - 1]?.sequence ?? 0;

  const emit = async (event: StreamEvent) => {
    eventSequence += 1;
    await deps.repositories.jobEvents.append({
      id: createEntityId('job_event'),
      job_id: currentJob.id,
      sequence: eventSequence,
      stage: event.stage,
      text: event.text,
      data: event.data,
    });
    return event;
  };

  try {
    yield await emit({ stage: 'validating_input', text: 'Validating the YouTube link...' });

    const metadataArtifact = await ingestPrimaryVideoStage(context, deps);
    if (!metadataArtifact?.content) {
      currentJob = await deps.repositories.jobs.update({
        ...currentJob,
        status: 'failed',
        error_message:
          'Could not resolve metadata for that YouTube video. Try another URL with an available video record.',
        finished_at: new Date().toISOString(),
      });

      yield await emit({
        stage: 'failed',
        text: currentJob.error_message,
      });
      return;
    }

    yield await emit({
      stage: 'transcript_fetched',
      text: 'Fetching the main video transcript...',
    });

    const { primaryVideo, transcriptArtifact } = await fetchPrimaryTranscriptStage(
      context,
      deps,
      metadataArtifact,
    );
    context.artifacts.primary_transcript_artifact_id = transcriptArtifact.id;

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
    const topicMapArtifact = await extractTopicsStage(context, deps, primaryVideo, transcriptArtifact);
    context.artifacts.topic_map_artifact_id = topicMapArtifact.id;

    yield await emit({
      stage: 'topics_found',
      data: {
        topics: topicMapArtifact.content.top_topics,
        summary: topicMapArtifact.content.overall_summary,
      },
    });

    yield await emit({
      stage: 'fetching_sources',
      text: 'Finding and caching transcript-backed support videos for each topic...',
    });
    const supportingVideoSelectionArtifact = await searchSupportingVideosStage(
      context,
      deps,
      primaryVideo,
      topicMapArtifact,
    );
    const supportingTranscriptArtifacts = await fetchSupportingTranscriptsStage(
      context,
      deps,
      supportingVideoSelectionArtifact,
    );
    context.artifacts.supporting_transcript_artifact_ids = supportingTranscriptArtifacts.map(
      (artifact) => artifact.id,
    );

    const { researchPack, sourceSelectionArtifact } = await buildResearchPackStage(
      context,
      deps,
      primaryVideo,
      topicMapArtifact,
      supportingVideoSelectionArtifact,
      supportingTranscriptArtifacts,
    );
    researchPackCreatedAt = researchPack.created_at;
    context.artifacts.source_selection_artifact_id = sourceSelectionArtifact.id;

    yield await emit({
      stage: 'sources_found',
      data: {
        sources: sourceSelectionArtifact.content.sources,
        topic_research: sourceSelectionArtifact.content.topic_research,
      },
    });

    yield await emit({ stage: 'synthesizing', text: 'Building the report plan from the research pack...' });
    yield await emit({
      stage: 'critiquing',
      text: 'Checking the report plan for missing nuance before writing...',
    });
    yield await emit({ stage: 'generating_report', text: 'Writing the final report...' });

    const { synthesisArtifact, criticArtifact, reportArtifact, report } = await renderReportStage(
      context,
      deps,
      primaryVideo,
      topicMapArtifact.content,
      sourceSelectionArtifact,
    );
    context.artifacts.synthesis_artifact_id = synthesisArtifact.id;
    context.artifacts.critic_artifact_id = criticArtifact.id;
    context.artifacts.report_artifact_id = reportArtifact.id;

    await deps.repositories.researchPacks.save({
      ...researchPack,
      synthesis_artifact_id: synthesisArtifact.id,
      critic_artifact_id: criticArtifact.id,
      created_at: researchPackCreatedAt ?? researchPack.created_at,
      updated_at: new Date().toISOString(),
    });

    const writer = new WriterAgent(deps.llm);
    for await (const chunk of writer.streamReport(reportArtifact.content.report_text)) {
      yield await emit({ stage: 'token', text: chunk });
    }

    const savedReport = await deps.repositories.reports.save(report);

    await buildExportsStage(context);

    currentJob = await deps.repositories.jobs.update({
      ...currentJob,
      status: 'completed',
      report_id: savedReport.id,
      finished_at: new Date().toISOString(),
      last_heartbeat_at: new Date().toISOString(),
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
    currentJob = await deps.repositories.jobs.update({
      ...currentJob,
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Internal server error',
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    yield await emit({
      stage: 'failed',
      text: currentJob.error_message,
    });
  }
}
