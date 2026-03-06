import { PrimaryVideo, TranscriptSegment, VideoSource } from './domain';

export interface LLMCallOptions {
  jsonMode?: boolean;
  system?: string;
}

export interface LLMProvider {
  readonly provider_name: string;
  readonly model_name: string;
  call(prompt: string, options?: LLMCallOptions): Promise<string>;
  callJson<T>(prompt: string, options?: Omit<LLMCallOptions, 'jsonMode'>): Promise<T>;
  stream(prompt: string, options?: Omit<LLMCallOptions, 'jsonMode'>): AsyncGenerator<string>;
}

export interface TranscriptProvider {
  readonly provider_name: string;
  getTranscript(videoIdOrUrl: string): Promise<string | null>;
  getTranscriptSegments(videoIdOrUrl: string): Promise<TranscriptSegment[] | null>;
}

export interface VideoProvider {
  readonly provider_name: string;
  extractVideoId(input: string): string | null;
  getVideoDetails(urlOrVideoId: string): Promise<VideoSource | null>;
  searchRelatedVideos(
    query: string,
    options?: { maxResults?: number; excludeVideoId?: string },
  ): Promise<VideoSource[]>;
}

export interface PrimaryVideoAssembler {
  assemblePrimaryVideo(url: string): Promise<PrimaryVideo | null>;
}
