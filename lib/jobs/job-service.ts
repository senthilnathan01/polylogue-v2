import { createEntityId } from '@/packages/core/pipeline';
import {
  ACTIVE_PROMPT_VERSIONS,
  buildIdempotencyKey,
  buildPromptBundleId,
  createPromptVersionReferences,
  Job,
  LengthType,
  Report,
} from '@/packages/core';
import { getResearchSystem } from '@/lib/research-system';
import { getCachedReport } from '@/lib/services/cache-service';
import { checkAndIncrement } from '@/lib/services/quota-service';

interface CreateJobResult {
  job: Job;
  reused: boolean;
}

function buildJobEventPayload(report: Report): Array<{
  stage: string;
  text?: string;
  data?: Record<string, unknown>;
}> {
  const events: Array<{
    stage: string;
    text?: string;
    data?: Record<string, unknown>;
  }> = [
    {
      stage: 'transcript_fetched',
      data: {
        title: report.primary_video.title,
        words: report.primary_video.transcript_word_count,
        duration_sec: report.primary_video.duration_sec,
        channel: report.primary_video.channel,
      },
    },
    {
      stage: 'topics_found',
      data: {
        topics: report.topics,
        summary: report.synthesis.executive_angle,
      },
    },
    {
      stage: 'sources_found',
      data: {
        sources: report.sources,
        topic_research: report.topic_research,
      },
    },
    {
      stage: 'generating_report',
      text: 'Replaying cached report...',
    },
  ];

  const chunkSize = 700;
  for (let index = 0; index < report.report_text.length; index += chunkSize) {
    events.push({
      stage: 'token',
      text: report.report_text.slice(index, index + chunkSize),
    });
  }

  events.push({
    stage: 'metadata',
    data: {
      report_id: report.id,
      title: report.title,
      thinking_text: report.thinking_text,
      primary_video: report.primary_video,
      topics: report.topics,
      sources: report.sources,
      topic_research: report.topic_research,
      word_count: report.word_count,
    },
  });
  events.push({ stage: 'done', data: {} });

  return events;
}

async function createReplayJob(report: Report): Promise<Job> {
  const system = getResearchSystem();
  const timestamp = new Date().toISOString();
  const job = await system.repositories.jobs.create({
    id: createEntityId('job'),
    youtube_url: report.youtube_url,
    canonical_video_id: report.canonical_video_id,
    length_type: report.length_type,
    status: 'completed',
    idempotency_key: report.idempotency_key,
    prompt_bundle_id: report.prompt_bundle_id,
    prompt_versions: report.prompt_versions,
    research_pack_id: report.research_pack_id,
    report_id: report.id,
    error_message: undefined,
    worker_id: 'replay-cache',
    started_at: timestamp,
    finished_at: timestamp,
    last_heartbeat_at: timestamp,
  });

  const events = buildJobEventPayload(report);

  for (const [index, event] of events.entries()) {
    await system.repositories.jobEvents.append({
      id: createEntityId('job_event'),
      job_id: job.id,
      sequence: index + 1,
      stage: event.stage as never,
      text: event.text,
      data: event.data,
    });
  }

  return job;
}

export async function createOrReuseJob(input: {
  youtubeUrl: string;
  lengthType: LengthType;
}): Promise<CreateJobResult> {
  const system = getResearchSystem();
  const canonicalVideoId = system.videoProvider.extractVideoId(input.youtubeUrl);

  if (!canonicalVideoId) {
    throw new Error('The YouTube URL did not contain a canonical video ID.');
  }

  const promptBundleId = buildPromptBundleId(ACTIVE_PROMPT_VERSIONS);
  const promptVersions = createPromptVersionReferences(
    ACTIVE_PROMPT_VERSIONS,
    system.llm.model_name,
  );
  const idempotencyKey = buildIdempotencyKey({
    canonical_video_id: canonicalVideoId,
    length_type: input.lengthType,
    prompt_bundle_id: promptBundleId,
  });

  const existingJob = await system.repositories.jobs.findLatestByIdempotencyKey(idempotencyKey);

  if (existingJob && existingJob.status !== 'failed') {
    return { job: existingJob, reused: true };
  }

  const cachedReport = await getCachedReport(input.youtubeUrl, input.lengthType);

  if (cachedReport) {
    return {
      job: await createReplayJob(cachedReport),
      reused: false,
    };
  }

  const { allowed, message } = await checkAndIncrement();

  if (!allowed) {
    throw new Error(message);
  }

  const job = await system.repositories.jobs.create({
    id: createEntityId('job'),
    youtube_url: input.youtubeUrl,
    canonical_video_id: canonicalVideoId,
    length_type: input.lengthType,
    status: 'pending',
    idempotency_key: idempotencyKey,
    prompt_bundle_id: promptBundleId,
    prompt_versions: promptVersions,
    research_pack_id: createEntityId('research_pack'),
    report_id: createEntityId('report'),
    error_message: undefined,
    worker_id: undefined,
    started_at: undefined,
    finished_at: undefined,
    last_heartbeat_at: undefined,
  });

  return { job, reused: false };
}

export async function getJobSnapshot(jobId: string): Promise<Job | null> {
  return getResearchSystem().repositories.jobs.getById(jobId);
}
