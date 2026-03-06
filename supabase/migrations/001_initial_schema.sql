CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_url TEXT NOT NULL,
  length_type TEXT NOT NULL CHECK (length_type IN ('short', 'medium', 'long')),
  title TEXT NOT NULL,
  report_text TEXT NOT NULL,
  thinking_text TEXT NOT NULL DEFAULT '',
  primary_video JSONB NOT NULL,
  topics JSONB NOT NULL,
  sources JSONB NOT NULL,
  topic_research JSONB NOT NULL,
  synthesis JSONB NOT NULL,
  word_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reports_lookup
ON reports (youtube_url, length_type, created_at DESC);

CREATE TABLE daily_usage (
  date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
  report_count INT NOT NULL DEFAULT 0,
  alert_sent BOOLEAN NOT NULL DEFAULT FALSE
);
