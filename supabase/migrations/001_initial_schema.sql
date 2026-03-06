CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_url TEXT NOT NULL,
  length_type TEXT NOT NULL CHECK (length_type IN ('short', 'medium', 'long')),
  report_text TEXT,
  thinking_text TEXT,
  sources JSONB,
  topics JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  vote_up INT DEFAULT 0,
  vote_down INT DEFAULT 0
);

CREATE UNIQUE INDEX idx_reports_unique_per_day
ON reports (youtube_url, length_type, ((created_at AT TIME ZONE 'UTC')::date));

CREATE TABLE claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  claim_type TEXT CHECK (claim_type IN ('factual', 'opinion', 'prediction', 'anecdotal')),
  confidence_score FLOAT,
  expert_alignment_score FLOAT,
  primary_timestamp_sec INT,
  source_urls TEXT[],
  source_timestamps INT[],
  is_contradiction BOOLEAN DEFAULT FALSE,
  contradiction_note TEXT
);

CREATE TABLE speakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  total_claims INT DEFAULT 0,
  verified_claims INT DEFAULT 0,
  score FLOAT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE daily_usage (
  date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
  report_count INT DEFAULT 0,
  alert_sent BOOLEAN DEFAULT FALSE
);

CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
  vote TEXT CHECK (vote IN ('up', 'down')),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
