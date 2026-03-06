CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE IF EXISTS reports
  ALTER COLUMN id TYPE TEXT USING id::text;

ALTER TABLE IF EXISTS reports
  ALTER COLUMN id DROP DEFAULT;

ALTER TABLE IF EXISTS reports
  ADD COLUMN IF NOT EXISTS job_id TEXT,
  ADD COLUMN IF NOT EXISTS research_pack_id TEXT,
  ADD COLUMN IF NOT EXISTS canonical_video_id TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS prompt_bundle_id TEXT,
  ADD COLUMN IF NOT EXISTS prompt_versions JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE reports
SET
  job_id = COALESCE(job_id, 'legacy-job-' || id),
  research_pack_id = COALESCE(research_pack_id, 'legacy-pack-' || id),
  canonical_video_id = COALESCE(canonical_video_id, primary_video->>'video_id', 'legacy-unknown-video'),
  prompt_bundle_id = COALESCE(prompt_bundle_id, 'legacy.inline-prompts'),
  idempotency_key = COALESCE(
    idempotency_key,
    'report:' || COALESCE(primary_video->>'video_id', 'legacy-unknown-video') || ':' || length_type || ':' || COALESCE(prompt_bundle_id, 'legacy.inline-prompts')
  )
WHERE
  job_id IS NULL
  OR research_pack_id IS NULL
  OR canonical_video_id IS NULL
  OR prompt_bundle_id IS NULL
  OR idempotency_key IS NULL;

DROP INDEX IF EXISTS idx_reports_lookup;

CREATE INDEX IF NOT EXISTS idx_reports_lookup
  ON reports (canonical_video_id, length_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reports_idempotency
  ON reports (idempotency_key);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  youtube_url TEXT NOT NULL,
  canonical_video_id TEXT NOT NULL,
  length_type TEXT NOT NULL CHECK (length_type IN ('short', 'medium', 'long')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  idempotency_key TEXT NOT NULL,
  prompt_bundle_id TEXT NOT NULL,
  prompt_versions JSONB NOT NULL DEFAULT '[]'::jsonb,
  research_pack_id TEXT NOT NULL,
  report_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobs_idempotency
  ON jobs (idempotency_key);

CREATE INDEX IF NOT EXISTS idx_jobs_status_created
  ON jobs (status, created_at DESC);

CREATE TABLE IF NOT EXISTS job_events (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  sequence INT NOT NULL,
  stage TEXT NOT NULL,
  text TEXT,
  data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_events_job_sequence
  ON job_events (job_id, sequence);

CREATE INDEX IF NOT EXISTS idx_job_events_job_created
  ON job_events (job_id, created_at ASC);

CREATE TABLE IF NOT EXISTS research_packs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  canonical_video_id TEXT NOT NULL,
  youtube_url TEXT NOT NULL,
  length_type TEXT NOT NULL CHECK (length_type IN ('short', 'medium', 'long')),
  prompt_bundle_id TEXT NOT NULL,
  prompt_versions JSONB NOT NULL DEFAULT '[]'::jsonb,
  primary_video JSONB NOT NULL,
  primary_transcript_artifact_id TEXT NOT NULL,
  supporting_transcript_artifact_ids TEXT[] NOT NULL DEFAULT '{}',
  topic_map_artifact_id TEXT NOT NULL,
  source_selection_artifact_id TEXT NOT NULL,
  synthesis_artifact_id TEXT,
  critic_artifact_id TEXT,
  provenance JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_packs_video_lookup
  ON research_packs (canonical_video_id, prompt_bundle_id, created_at DESC);

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (
    kind IN (
      'transcript',
      'primary_transcript',
      'supporting_transcript',
      'topic_map',
      'source_selection',
      'synthesis_plan',
      'critic_notes',
      'report_markdown',
      'export_bundle'
    )
  ),
  job_id TEXT,
  research_pack_id TEXT,
  prompt_version JSONB,
  cache_key TEXT,
  content_inline JSONB,
  storage_backend TEXT NOT NULL DEFAULT 'inline' CHECK (storage_backend IN ('inline', 'supabase_storage')),
  storage_bucket TEXT,
  storage_path TEXT,
  content_type TEXT,
  byte_size INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_artifacts_research_pack
  ON artifacts (research_pack_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_artifacts_cache_key
  ON artifacts (cache_key, created_at DESC);

CREATE TABLE IF NOT EXISTS usage_counters (
  day DATE PRIMARY KEY,
  report_count INT NOT NULL DEFAULT 0,
  alert_sent BOOLEAN NOT NULL DEFAULT FALSE
);

INSERT INTO usage_counters (day, report_count, alert_sent)
SELECT date, report_count, alert_sent
FROM daily_usage
ON CONFLICT (day) DO UPDATE
SET
  report_count = EXCLUDED.report_count,
  alert_sent = EXCLUDED.alert_sent;

CREATE TABLE IF NOT EXISTS exports (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  research_pack_id TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('obsidian_vault', 'markdown_bundle')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'ready', 'failed')),
  artifact_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO storage.buckets (id, name, public)
VALUES ('research-artifacts', 'research-artifacts', FALSE)
ON CONFLICT (id) DO NOTHING;
