import { createEntityId } from '@/packages/core/pipeline';
import { TranscriptProvider, VideoProvider } from '@/packages/core/providers';
import { ArtifactRepository } from '@/packages/core/repositories';
import { TranscriptSegment } from '@/packages/core/domain';

interface TranscriptArtifactPayload {
  video_id: string;
  transcript: string;
  transcript_segments: TranscriptSegment[];
  transcript_word_count: number;
}

function isTranscriptArtifactPayload(value: unknown): value is TranscriptArtifactPayload {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'video_id' in value &&
      'transcript' in value &&
      'transcript_segments' in value,
  );
}

export function getTranscriptArtifactCacheKey(videoId: string): string {
  return `transcript:${videoId}`;
}

export class CachedTranscriptProvider implements TranscriptProvider {
  readonly provider_name: string;

  constructor(
    private readonly inner: TranscriptProvider,
    private readonly artifacts: ArtifactRepository,
    private readonly videoProvider: VideoProvider,
  ) {
    this.provider_name = `${inner.provider_name}+artifact-cache`;
  }

  async getTranscript(videoIdOrUrl: string): Promise<string | null> {
    const segments = await this.getTranscriptSegments(videoIdOrUrl);
    return segments?.map((segment) => segment.text).join(' ') ?? null;
  }

  async getTranscriptSegments(videoIdOrUrl: string): Promise<TranscriptSegment[] | null> {
    const videoId = this.videoProvider.extractVideoId(videoIdOrUrl);

    if (!videoId) {
      return this.inner.getTranscriptSegments(videoIdOrUrl);
    }

    const cachedArtifact =
      await this.artifacts.findLatestByCacheKey<TranscriptArtifactPayload>(
        getTranscriptArtifactCacheKey(videoId),
      );

    if (cachedArtifact?.content && isTranscriptArtifactPayload(cachedArtifact.content)) {
      return cachedArtifact.content.transcript_segments;
    }

    const segments = await this.inner.getTranscriptSegments(videoIdOrUrl);

    if (!segments || segments.length === 0) {
      return null;
    }

    const transcript = segments.map((segment) => segment.text).join(' ');

    try {
      await this.artifacts.save<TranscriptArtifactPayload>({
        id: createEntityId('artifact'),
        kind: 'transcript',
        cache_key: getTranscriptArtifactCacheKey(videoId),
        content: {
          video_id: videoId,
          transcript,
          transcript_segments: segments,
          transcript_word_count: transcript.split(/\s+/).filter(Boolean).length,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`Failed to cache transcript artifact for ${videoId}:`, error);
    }

    return segments;
  }
}
