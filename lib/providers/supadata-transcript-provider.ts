import { TranscriptSegment } from '@/packages/core/domain';
import { TranscriptProvider } from '@/packages/core/providers';
import { extractVideoId } from '@/packages/core/youtube';

type SupadataTranscriptResponse = {
  content?: Array<{
    text?: string;
    offset?: number;
    duration?: number;
    lang?: string;
  }> | string;
  lang?: string;
  availableLangs?: string[];
};

function getSupadataApiKey(): string {
  const apiKey = process.env.SUPADATA_API_KEY;

  if (!apiKey) {
    throw new Error('SUPADATA_API_KEY is not set.');
  }

  return apiKey;
}

async function fetchSupadataTranscript(
  urlOrVideoId: string,
): Promise<SupadataTranscriptResponse> {
  const url = new URL('https://api.supadata.ai/v1/youtube/transcript');
  const videoId = extractVideoId(urlOrVideoId);

  if (urlOrVideoId.startsWith('http://') || urlOrVideoId.startsWith('https://')) {
    url.searchParams.set('url', urlOrVideoId);
  } else if (videoId) {
    url.searchParams.set('videoId', videoId);
  } else {
    throw new Error('Invalid YouTube URL or video ID.');
  }

  url.searchParams.set('lang', 'en');

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'x-api-key': getSupadataApiKey(),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supadata transcript request failed with ${response.status}: ${body}`);
  }

  return (await response.json()) as SupadataTranscriptResponse;
}

export class SupadataTranscriptProvider implements TranscriptProvider {
  readonly provider_name = 'supadata';

  async getTranscript(videoIdOrUrl: string): Promise<string | null> {
    const segments = await this.getTranscriptSegments(videoIdOrUrl);
    return segments?.map((segment) => segment.text).join(' ') ?? null;
  }

  async getTranscriptSegments(videoIdOrUrl: string): Promise<TranscriptSegment[] | null> {
    try {
      const transcript = await fetchSupadataTranscript(videoIdOrUrl);
      const content = Array.isArray(transcript.content) ? transcript.content : null;

      if (!content || content.length === 0) {
        return null;
      }

      return content
        .filter((item) => typeof item.text === 'string' && item.text.trim().length > 0)
        .map((item) => {
          const start = Number(item.offset ?? 0) / 1000;
          const duration = Number(item.duration ?? 0) / 1000;

          return {
            text: item.text!.trim(),
            start,
            duration,
            end: start + duration,
          };
        });
    } catch (error) {
      console.error(`Error fetching Supadata transcript for ${videoIdOrUrl}:`, error);
      return null;
    }
  }
}
