ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS worker_id TEXT,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_jobs_pending_queue
  ON jobs (status, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_jobs_worker_heartbeat
  ON jobs (worker_id, last_heartbeat_at DESC);
