ALTER TABLE artifacts
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS provenance JSONB;

ALTER TABLE artifacts
  DROP CONSTRAINT IF EXISTS artifacts_kind_check;

ALTER TABLE artifacts
  ADD CONSTRAINT artifacts_kind_check CHECK (
    kind IN (
      'primary_video_metadata',
      'transcript',
      'primary_transcript',
      'supporting_video_selection',
      'supporting_transcript',
      'topic_map',
      'source_selection',
      'synthesis_plan',
      'critic_notes',
      'report_markdown',
      'export_bundle'
    )
  );
