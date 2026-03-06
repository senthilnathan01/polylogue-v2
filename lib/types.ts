export type LengthType = 'short' | 'medium' | 'long';

export interface Report {
  id: string;
  youtube_url: string;
  length_type: LengthType;
  report_text: string | null;
  thinking_text: string | null;
  sources: VideoSource[] | null;
  topics: Topic[] | null;
  created_at: string;
  vote_up: number;
  vote_down: number;
}

export interface Claim {
  id?: string;
  report_id?: string;
  text: string;
  claim_type: 'factual' | 'opinion' | 'prediction' | 'anecdotal';
  confidence_score: number;
  expert_alignment_score?: number;
  primary_timestamp_sec: number;
  source_urls: string[];
  source_timestamps: number[];
  is_contradiction: boolean;
  contradiction_note?: string;
}

export interface Topic {
  name: string;
  depth_score: number; // 0-100
}

export interface VideoSource {
  video_id: string;
  title: string;
  url: string;
  channel: string;
  view_count: number;
  passages?: string[];
}

export interface ExtractorOutput {
  all_topics: Topic[];
  top_5_topics: Topic[];
  claims: Claim[];
  speakers: string[];
  primary_video_duration_sec: number;
}

export interface SourceAgentOutput {
  sources: VideoSource[];
}

export interface VerifiedClaim extends Claim {
  verification_notes: string;
}

export interface Contradiction {
  claim_text: string;
  contradiction_text: string;
  source_url?: string;
  timestamp_sec?: number;
}

export interface TopicCoverage {
  topic_name: string;
  covered: boolean;
}

export interface SynthesizerOutput {
  verified_claims: VerifiedClaim[];
  contradictions: Contradiction[];
  topics_coverage: TopicCoverage[];
  thinking_notes: string;
}

export interface CriticOutput {
  overconfident_claims: string[];
  missed_claims: string[];
  missed_contradictions: string[];
  suppressed_nuance: string[];
  overall_quality_score: number;
}

export interface WriterOutput {
  report_text: string;
  thinking_text: string;
}

export interface StreamEvent {
  stage?: string;
  data?: any;
  text?: string;
}
