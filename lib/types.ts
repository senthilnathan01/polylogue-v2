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

export interface Report {
  id: string;
  youtube_url: string;
  length_type: LengthType;
  title: string;
  report_text: string;
  thinking_text: string;
  primary_video: Omit<PrimaryVideo, 'transcript' | 'transcript_segments'>;
  topics: Topic[];
  sources: VideoSource[];
  topic_research: TopicResearch[];
  synthesis: SynthesizerOutput;
  created_at: string;
  updated_at: string;
  word_count: number;
}

export interface StreamEvent {
  stage: GenerationStage;
  data?: unknown;
  text?: string;
}
