import { SupabaseClient } from '@supabase/supabase-js';

import {
  ArtifactRecord,
  ExportBundle,
  Job,
  JobEvent,
  Report,
  ResearchPack,
} from '@/packages/core/domain';
import { RepositoryBundle } from '@/packages/core/repositories';

const ARTIFACTS_BUCKET = process.env.SUPABASE_ARTIFACTS_BUCKET ?? 'research-artifacts';
const INLINE_ARTIFACT_MAX_BYTES = Number(process.env.SUPABASE_INLINE_ARTIFACT_MAX_BYTES ?? 20000);

function now(): string {
  return new Date().toISOString();
}

function normalizeError(context: string, error: { message?: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? 'Unknown Supabase error'}`);
}

function mapJob(row: Record<string, unknown>): Job {
  return {
    id: String(row.id),
    youtube_url: String(row.youtube_url),
    canonical_video_id: String(row.canonical_video_id),
    length_type: row.length_type as Job['length_type'],
    status: row.status as Job['status'],
    idempotency_key: String(row.idempotency_key),
    prompt_bundle_id: String(row.prompt_bundle_id),
    prompt_versions: Array.isArray(row.prompt_versions) ? (row.prompt_versions as Job['prompt_versions']) : [],
    research_pack_id: String(row.research_pack_id),
    report_id: row.report_id ? String(row.report_id) : undefined,
    error_message: row.error_message ? String(row.error_message) : undefined,
    worker_id: row.worker_id ? String(row.worker_id) : undefined,
    started_at: row.started_at ? String(row.started_at) : undefined,
    finished_at: row.finished_at ? String(row.finished_at) : undefined,
    last_heartbeat_at: row.last_heartbeat_at ? String(row.last_heartbeat_at) : undefined,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapJobEvent(row: Record<string, unknown>): JobEvent {
  return {
    id: String(row.id),
    job_id: String(row.job_id),
    sequence: Number(row.sequence),
    stage: row.stage as JobEvent['stage'],
    text: row.text ? String(row.text) : undefined,
    data: row.data,
    created_at: String(row.created_at),
  };
}

function mapReport(row: Record<string, unknown>): Report {
  return {
    id: String(row.id),
    job_id: String(row.job_id),
    research_pack_id: String(row.research_pack_id),
    canonical_video_id: String(row.canonical_video_id),
    idempotency_key: String(row.idempotency_key),
    prompt_bundle_id: String(row.prompt_bundle_id),
    prompt_versions: Array.isArray(row.prompt_versions)
      ? (row.prompt_versions as Report['prompt_versions'])
      : [],
    youtube_url: String(row.youtube_url),
    length_type: row.length_type as Report['length_type'],
    title: String(row.title),
    report_text: String(row.report_text ?? ''),
    thinking_text: String(row.thinking_text ?? ''),
    primary_video: row.primary_video as Report['primary_video'],
    topics: Array.isArray(row.topics) ? (row.topics as Report['topics']) : [],
    sources: Array.isArray(row.sources) ? (row.sources as Report['sources']) : [],
    topic_research: Array.isArray(row.topic_research)
      ? (row.topic_research as Report['topic_research'])
      : [],
    synthesis: row.synthesis as Report['synthesis'],
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    word_count: Number(row.word_count ?? 0),
  };
}

function mapResearchPack(row: Record<string, unknown>): ResearchPack {
  return {
    id: String(row.id),
    job_id: String(row.job_id),
    canonical_video_id: String(row.canonical_video_id),
    youtube_url: String(row.youtube_url),
    length_type: row.length_type as ResearchPack['length_type'],
    prompt_bundle_id: String(row.prompt_bundle_id),
    prompt_versions: Array.isArray(row.prompt_versions)
      ? (row.prompt_versions as ResearchPack['prompt_versions'])
      : [],
    primary_video: row.primary_video as ResearchPack['primary_video'],
    primary_transcript_artifact_id: String(row.primary_transcript_artifact_id),
    supporting_transcript_artifact_ids: Array.isArray(row.supporting_transcript_artifact_ids)
      ? (row.supporting_transcript_artifact_ids as string[])
      : [],
    topic_map_artifact_id: String(row.topic_map_artifact_id),
    source_selection_artifact_id: String(row.source_selection_artifact_id),
    synthesis_artifact_id: row.synthesis_artifact_id
      ? String(row.synthesis_artifact_id)
      : undefined,
    critic_artifact_id: row.critic_artifact_id ? String(row.critic_artifact_id) : undefined,
    provenance: row.provenance as ResearchPack['provenance'],
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapExportBundle(row: Record<string, unknown>): ExportBundle {
  return {
    id: String(row.id),
    report_id: String(row.report_id),
    research_pack_id: String(row.research_pack_id),
    format: row.format as ExportBundle['format'],
    status: row.status as ExportBundle['status'],
    artifact_id: row.artifact_id ? String(row.artifact_id) : undefined,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

async function serializeArtifactContent<T>(
  client: SupabaseClient,
  artifact: ArtifactRecord<T>,
): Promise<{
  content_inline: T | null;
  storage_backend: 'inline' | 'supabase_storage';
  storage_bucket: string | null;
  storage_path: string | null;
  content_type: string | null;
  byte_size: number | null;
}> {
  const serialized = artifact.content === null ? null : JSON.stringify(artifact.content);
  const byteSize = serialized ? Buffer.byteLength(serialized, 'utf8') : 0;
  const shouldUseStorage =
    artifact.storage_backend === 'supabase_storage' ||
    artifact.kind === 'transcript' ||
    artifact.kind === 'primary_transcript' ||
    artifact.kind === 'supporting_transcript' ||
    artifact.kind === 'export_bundle' ||
    byteSize > INLINE_ARTIFACT_MAX_BYTES;

  if (!serialized || !shouldUseStorage) {
    return {
      content_inline: artifact.content,
      storage_backend: 'inline',
      storage_bucket: null,
      storage_path: null,
      content_type: serialized ? 'application/json' : null,
      byte_size: serialized ? byteSize : null,
    };
  }

  const storagePath = artifact.storage_path ?? `${artifact.kind}/${artifact.id}.json`;
  const upload = await client.storage.from(ARTIFACTS_BUCKET).upload(
    storagePath,
    Buffer.from(serialized, 'utf8'),
    {
      contentType: artifact.content_type ?? 'application/json',
      upsert: true,
    },
  );

  if (upload.error) {
    normalizeError(`Failed to upload artifact ${artifact.id}`, upload.error);
  }

  return {
    content_inline: null,
    storage_backend: 'supabase_storage',
    storage_bucket: ARTIFACTS_BUCKET,
    storage_path: storagePath,
    content_type: artifact.content_type ?? 'application/json',
    byte_size: byteSize,
  };
}

async function hydrateArtifactContent<T>(
  client: SupabaseClient,
  row: Record<string, unknown>,
): Promise<T | null> {
  if (row.content_inline !== null && row.content_inline !== undefined) {
    return row.content_inline as T;
  }

  if (!row.storage_bucket || !row.storage_path) {
    return null;
  }

  const download = await client.storage
    .from(String(row.storage_bucket))
    .download(String(row.storage_path));

  if (download.error) {
    normalizeError(`Failed to download artifact ${String(row.id)}`, download.error);
  }

  const raw = await download.data.text();
  return JSON.parse(raw) as T;
}

async function mapArtifact<T>(
  client: SupabaseClient,
  row: Record<string, unknown>,
): Promise<ArtifactRecord<T>> {
  return {
    id: String(row.id),
    kind: row.kind as ArtifactRecord<T>['kind'],
    job_id: row.job_id ? String(row.job_id) : undefined,
    research_pack_id: row.research_pack_id ? String(row.research_pack_id) : undefined,
    prompt_version: row.prompt_version
      ? (row.prompt_version as ArtifactRecord<T>['prompt_version'])
      : undefined,
    cache_key: row.cache_key ? String(row.cache_key) : undefined,
    metadata: row.metadata ? (row.metadata as ArtifactRecord<T>['metadata']) : undefined,
    provenance: row.provenance ? (row.provenance as ArtifactRecord<T>['provenance']) : undefined,
    content: await hydrateArtifactContent<T>(client, row),
    storage_backend: row.storage_backend
      ? (row.storage_backend as ArtifactRecord<T>['storage_backend'])
      : undefined,
    storage_bucket: row.storage_bucket ? String(row.storage_bucket) : undefined,
    storage_path: row.storage_path ? String(row.storage_path) : undefined,
    content_type: row.content_type ? String(row.content_type) : undefined,
    byte_size: row.byte_size ? Number(row.byte_size) : undefined,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function createSupabaseResearchRepositories(client: SupabaseClient): RepositoryBundle {
  return {
    jobs: {
      async create(job) {
        const timestamp = now();
        const { data, error } = await client
          .from('jobs')
          .insert({
            ...job,
            created_at: timestamp,
            updated_at: timestamp,
          })
          .select()
          .single();

        if (error || !data) {
          normalizeError('Failed to create job', error);
        }

        return mapJob(data);
      },

      async update(job) {
        const { data, error } = await client
          .from('jobs')
          .upsert({
            ...job,
            updated_at: now(),
          })
          .select()
          .single();

        if (error || !data) {
          normalizeError(`Failed to update job ${job.id}`, error);
        }

        return mapJob(data);
      },

      async getById(id) {
        const { data, error } = await client.from('jobs').select('*').eq('id', id).maybeSingle();

        if (error) {
          normalizeError(`Failed to fetch job ${id}`, error);
        }

        return data ? mapJob(data) : null;
      },

      async findLatestByIdempotencyKey(idempotencyKey) {
        const { data, error } = await client
          .from('jobs')
          .select('*')
          .eq('idempotency_key', idempotencyKey)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          normalizeError(`Failed to fetch job by idempotency key ${idempotencyKey}`, error);
        }

        return data ? mapJob(data) : null;
      },

      async claimNextPending(workerId) {
        const { data: candidate, error: fetchError } = await client
          .from('jobs')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (fetchError) {
          normalizeError('Failed to fetch pending job for claim', fetchError);
        }

        if (!candidate) {
          return null;
        }

        const timestamp = now();
        const { data, error } = await client
          .from('jobs')
          .update({
            status: 'running',
            worker_id: workerId,
            started_at: candidate.started_at ?? timestamp,
            last_heartbeat_at: timestamp,
            updated_at: timestamp,
          })
          .eq('id', candidate.id)
          .eq('status', 'pending')
          .select('*')
          .maybeSingle();

        if (error) {
          normalizeError(`Failed to claim job ${String(candidate.id)}`, error);
        }

        return data ? mapJob(data) : null;
      },

      async touchHeartbeat(jobId, workerId) {
        const timestamp = now();
        const { data, error } = await client
          .from('jobs')
          .update({
            last_heartbeat_at: timestamp,
            updated_at: timestamp,
          })
          .eq('id', jobId)
          .eq('worker_id', workerId)
          .select('*')
          .maybeSingle();

        if (error) {
          normalizeError(`Failed to update heartbeat for job ${jobId}`, error);
        }

        return data ? mapJob(data) : null;
      },
    },

    jobEvents: {
      async append(event) {
        const { data, error } = await client
          .from('job_events')
          .insert({
            ...event,
            created_at: now(),
          })
          .select()
          .single();

        if (error || !data) {
          normalizeError(`Failed to append event ${event.id}`, error);
        }

        return mapJobEvent(data);
      },

      async listByJobId(jobId) {
        const { data, error } = await client
          .from('job_events')
          .select('*')
          .eq('job_id', jobId)
          .order('sequence', { ascending: true });

        if (error) {
          normalizeError(`Failed to list events for job ${jobId}`, error);
        }

        return (data ?? []).map((row) => mapJobEvent(row));
      },
    },

    reports: {
      async save(report) {
        const { data, error } = await client
          .from('reports')
          .upsert({
            ...report,
            updated_at: now(),
          })
          .select()
          .single();

        if (error || !data) {
          normalizeError(`Failed to save report ${report.id}`, error);
        }

        return mapReport(data);
      },

      async getById(id) {
        const { data, error } = await client.from('reports').select('*').eq('id', id).maybeSingle();

        if (error) {
          normalizeError(`Failed to fetch report ${id}`, error);
        }

        return data ? mapReport(data) : null;
      },

      async findLatestByIdempotencyKey(idempotencyKey) {
        const { data, error } = await client
          .from('reports')
          .select('*')
          .eq('idempotency_key', idempotencyKey)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          normalizeError(`Failed to fetch report by idempotency key ${idempotencyKey}`, error);
        }

        return data ? mapReport(data) : null;
      },
    },

    researchPacks: {
      async save(researchPack) {
        const { data, error } = await client
          .from('research_packs')
          .upsert({
            ...researchPack,
            updated_at: now(),
          })
          .select()
          .single();

        if (error || !data) {
          normalizeError(`Failed to save research pack ${researchPack.id}`, error);
        }

        return mapResearchPack(data);
      },

      async getById(id) {
        const { data, error } = await client
          .from('research_packs')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error) {
          normalizeError(`Failed to fetch research pack ${id}`, error);
        }

        return data ? mapResearchPack(data) : null;
      },
    },

    artifacts: {
      async save<T>(artifact: ArtifactRecord<T>) {
        const storage = await serializeArtifactContent(client, artifact);
        const { data, error } = await client
          .from('artifacts')
          .upsert({
            id: artifact.id,
            kind: artifact.kind,
            job_id: artifact.job_id ?? null,
            research_pack_id: artifact.research_pack_id ?? null,
            prompt_version: artifact.prompt_version ?? null,
            cache_key: artifact.cache_key ?? null,
            metadata: artifact.metadata ?? null,
            provenance: artifact.provenance ?? null,
            content_inline: storage.content_inline,
            storage_backend: storage.storage_backend,
            storage_bucket: storage.storage_bucket,
            storage_path: storage.storage_path,
            content_type: storage.content_type,
            byte_size: storage.byte_size,
            created_at: artifact.created_at,
            updated_at: now(),
          })
          .select('*')
          .single();

        if (error || !data) {
          normalizeError(`Failed to save artifact ${artifact.id}`, error);
        }

        return mapArtifact<T>(client, data);
      },

      async getById<T>(id: string) {
        const { data, error } = await client.from('artifacts').select('*').eq('id', id).maybeSingle();

        if (error) {
          normalizeError(`Failed to fetch artifact ${id}`, error);
        }

        return data ? mapArtifact<T>(client, data) : null;
      },

      async listByResearchPackId(researchPackId) {
        const { data, error } = await client
          .from('artifacts')
          .select('*')
          .eq('research_pack_id', researchPackId)
          .order('created_at', { ascending: true });

        if (error) {
          normalizeError(`Failed to list artifacts for research pack ${researchPackId}`, error);
        }

        return Promise.all((data ?? []).map((row) => mapArtifact(client, row)));
      },

      async findLatestByCacheKey<T>(cacheKey: string) {
        const { data, error } = await client
          .from('artifacts')
          .select('*')
          .eq('cache_key', cacheKey)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          normalizeError(`Failed to fetch artifact by cache key ${cacheKey}`, error);
        }

        return data ? mapArtifact<T>(client, data) : null;
      },
    },

    exports: {
      async save(bundle) {
        const { data, error } = await client
          .from('exports')
          .upsert({
            ...bundle,
            updated_at: now(),
          })
          .select()
          .single();

        if (error || !data) {
          normalizeError(`Failed to save export bundle ${bundle.id}`, error);
        }

        return mapExportBundle(data);
      },

      async getById(id) {
        const { data, error } = await client.from('exports').select('*').eq('id', id).maybeSingle();

        if (error) {
          normalizeError(`Failed to fetch export bundle ${id}`, error);
        }

        return data ? mapExportBundle(data) : null;
      },
    },

    usage: {
      async incrementDailyCount(day) {
        const currentCount = await this.getDailyCount(day);
        const alertSent = await this.hasSentAlert(day);
        const nextCount = currentCount + 1;
        const { error } = await client.from('usage_counters').upsert({
          day,
          report_count: nextCount,
          alert_sent: alertSent,
        });

        if (error) {
          normalizeError(`Failed to increment usage counter for ${day}`, error);
        }

        return nextCount;
      },

      async getDailyCount(day) {
        const { data, error } = await client
          .from('usage_counters')
          .select('report_count')
          .eq('day', day)
          .maybeSingle();

        if (error) {
          normalizeError(`Failed to fetch usage counter for ${day}`, error);
        }

        return Number(data?.report_count ?? 0);
      },

      async hasSentAlert(day) {
        const { data, error } = await client
          .from('usage_counters')
          .select('alert_sent')
          .eq('day', day)
          .maybeSingle();

        if (error) {
          normalizeError(`Failed to fetch usage alert flag for ${day}`, error);
        }

        return Boolean(data?.alert_sent);
      },

      async markAlertSent(day) {
        const count = await this.getDailyCount(day);
        const { error } = await client.from('usage_counters').upsert({
          day,
          report_count: count,
          alert_sent: true,
        });

        if (error) {
          normalizeError(`Failed to mark usage alert as sent for ${day}`, error);
        }
      },
    },
  };
}
