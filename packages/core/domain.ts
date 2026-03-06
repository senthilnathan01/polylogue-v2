export type EntityId = string;

export type LengthType = 'short' | 'medium' | 'long';

export type GenerationStage =
  | 'validating_input'
  | 'transcript_fetched'
  | 'extracting_topics'
  | 'topics_found'
  | 'fetching_sources'
  | 'sources_found'
  | 'synthesizing'
  | 'critiquing'
  | 'generating_report'
  | 'token'
  | 'metadata'
  | 'done'
  | 'failed';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export type ArtifactKind =
  | 'transcript'
  | 'primary_transcript'
  | 'supporting_transcript'
  | 'topic_map'
  | 'source_selection'
  | 'synthesis_plan'
  | 'critic_notes'
  | 'report_markdown'
  | 'export_bundle';

export type PromptKey =
  | 'extractor'
  | 'source_analysis'
  | 'synthesizer'
  | 'critic'
  | 'writer';

export interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
  end: number;
}

export interface InsightPoint {
  text: string;
  timestamp_sec?: number;
}

export interface Topic {
  name: string;
  summary: string;
  importance: string;
  search_query: string;
  keywords: string[];
  rank: number;
}

export interface VideoSource {
  video_id: string;
  title: string;
  url: string;
  channel: string;
  view_count: number;
  published_at?: string;
  duration_sec?: number;
  description?: string;
  topic_name?: string;
  selection_reason?: string;
  transcript_word_count?: number;
  transcript_excerpt?: string;
  research_notes?: string;
  takeaways?: InsightPoint[];
  nuances?: InsightPoint[];
  tensions?: InsightPoint[];
}

export interface PrimaryVideo {
  video_id: string;
  title: string;
  url: string;
  channel: string;
  view_count: number;
  published_at?: string;
  duration_sec: number;
  description?: string;
  transcript: string;
  transcript_segments: TranscriptSegment[];
  transcript_word_count: number;
}

export type PrimaryVideoMetadata = Omit<PrimaryVideo, 'transcript' | 'transcript_segments'>;

export interface ExtractorOutput {
  overall_summary: string;
  top_topics: Topic[];
}

export interface TopicResearch {
  topic: Topic;
  source: VideoSource | null;
  connection_summary: string;
  support_takeaways: InsightPoint[];
  nuanced_details: InsightPoint[];
  tensions: InsightPoint[];
}

export interface SourceAgentOutput {
  sources: VideoSource[];
  topic_research: TopicResearch[];
}

export interface SynthesisSection {
  heading: string;
  topic_name: string;
  narrative_goal: string;
  key_points: string[];
  supporting_videos: string[];
  nuance_to_preserve: string[];
}

export interface SynthesizerOutput {
  report_title: string;
  executive_angle: string;
  section_plan: SynthesisSection[];
  cross_video_patterns: string[];
  unanswered_questions: string[];
  writing_brief: string;
}

export interface CriticOutput {
  missing_angles: string[];
  weak_sections: string[];
  nuance_to_preserve: string[];
  revision_goals: string[];
  quality_score: number;
}

export interface WriterOutput {
  title: string;
  report_text: string;
  thinking_text: string;
}

export interface PromptVersion {
  id: string;
  key: PromptKey;
  version: string;
  label: string;
  description: string;
  created_at: string;
}

export interface PromptVersionReference {
  id: string;
  key: PromptKey;
  version: string;
  model: string;
}

export interface ArtifactRecord<T = unknown> {
  id: string;
  kind: ArtifactKind;
  job_id?: string;
  research_pack_id?: string;
  prompt_version?: PromptVersionReference;
  cache_key?: string;
  content: T | null;
  storage_backend?: 'inline' | 'supabase_storage';
  storage_bucket?: string;
  storage_path?: string;
  content_type?: string;
  byte_size?: number;
  created_at: string;
  updated_at: string;
}

export interface ResearchPack {
  id: string;
  job_id: string;
  canonical_video_id: string;
  youtube_url: string;
  length_type: LengthType;
  prompt_bundle_id: string;
  prompt_versions: PromptVersionReference[];
  primary_video: PrimaryVideoMetadata;
  primary_transcript_artifact_id: string;
  supporting_transcript_artifact_ids: string[];
  topic_map_artifact_id: string;
  source_selection_artifact_id: string;
  synthesis_artifact_id?: string;
  critic_artifact_id?: string;
  provenance: {
    transcript_provider: string;
    video_provider: string;
    llm_model: string;
  };
  created_at: string;
  updated_at: string;
}

export interface Report {
  id: string;
  job_id: string;
  research_pack_id: string;
  canonical_video_id: string;
  idempotency_key: string;
  prompt_bundle_id: string;
  prompt_versions: PromptVersionReference[];
  youtube_url: string;
  length_type: LengthType;
  title: string;
  report_text: string;
  thinking_text: string;
  primary_video: PrimaryVideoMetadata;
  topics: Topic[];
  sources: VideoSource[];
  topic_research: TopicResearch[];
  synthesis: SynthesizerOutput;
  created_at: string;
  updated_at: string;
  word_count: number;
}

export interface Job {
  id: string;
  youtube_url: string;
  canonical_video_id: string;
  length_type: LengthType;
  status: JobStatus;
  idempotency_key: string;
  prompt_bundle_id: string;
  prompt_versions: PromptVersionReference[];
  research_pack_id: string;
  report_id?: string;
  error_message?: string;
  worker_id?: string;
  started_at?: string;
  finished_at?: string;
  last_heartbeat_at?: string;
  created_at: string;
  updated_at: string;
}

export interface JobEvent {
  id: string;
  job_id: string;
  sequence: number;
  stage: GenerationStage;
  text?: string;
  data?: unknown;
  created_at: string;
}

export interface ExportBundle {
  id: string;
  report_id: string;
  research_pack_id: string;
  format: 'obsidian_vault' | 'markdown_bundle';
  status: 'pending' | 'ready' | 'failed';
  artifact_id?: string;
  created_at: string;
  updated_at: string;
}

export interface StreamEvent {
  stage: GenerationStage;
  data?: unknown;
  text?: string;
}

export interface PipelineArtifactRefs {
  primary_transcript_artifact_id?: string;
  supporting_transcript_artifact_ids: string[];
  topic_map_artifact_id?: string;
  source_selection_artifact_id?: string;
  synthesis_artifact_id?: string;
  critic_artifact_id?: string;
  report_artifact_id?: string;
}

export interface PipelineRequest {
  youtube_url: string;
  length_type: LengthType;
}

export interface PipelineContext {
  request: PipelineRequest;
  canonical_video_id: string;
  idempotency_key: string;
  prompt_bundle_id: string;
  prompt_versions: PromptVersionReference[];
  job_id: string;
  research_pack_id: string;
  report_id: string;
  artifacts: PipelineArtifactRefs;
}
