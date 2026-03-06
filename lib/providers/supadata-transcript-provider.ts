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

const DEFAULT_MIN_INTERVAL_MS = 1500;
const DEFAULT_RETRY_COUNT = 4;
const DEFAULT_BACKOFF_MS = 2500;

let nextAvailableRequestAt = 0;
let requestQueue: Promise<void> = Promise.resolve();

function getSupadataApiKey(): string {
  const apiKey = process.env.SUPADATA_API_KEY;

  if (!apiKey) {
    throw new Error('SUPADATA_API_KEY is not set.');
  }

  return apiKey;
}

function getMinIntervalMs(): number {
  const value = Number(process.env.SUPADATA_MIN_INTERVAL_MS ?? DEFAULT_MIN_INTERVAL_MS);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_MIN_INTERVAL_MS;
}

function getRetryCount(): number {
  const value = Number(process.env.SUPADATA_RETRY_COUNT ?? DEFAULT_RETRY_COUNT);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_RETRY_COUNT;
}

function getRetryBaseDelayMs(): number {
  const value = Number(process.env.SUPADATA_RETRY_BASE_DELAY_MS ?? DEFAULT_BACKOFF_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_BACKOFF_MS;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scheduleSupadataRequest(): Promise<void> {
  const minIntervalMs = getMinIntervalMs();

  const scheduled = requestQueue.then(async () => {
    const waitMs = Math.max(0, nextAvailableRequestAt - Date.now());

    if (waitMs > 0) {
      await sleep(waitMs);
    }

    nextAvailableRequestAt = Date.now() + minIntervalMs;
  });

  requestQueue = scheduled.catch(() => undefined);
  await scheduled;
}

function parseRetryAfterMs(response: Response): number | null {
  const retryAfter = response.headers.get('retry-after');

  if (!retryAfter) {
    return null;
  }

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const retryAt = Date.parse(retryAfter);
  if (!Number.isNaN(retryAt)) {
    return Math.max(0, retryAt - Date.now());
  }

  return null;
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

  const maxRetries = getRetryCount();

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    await scheduleSupadataRequest();

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'x-api-key': getSupadataApiKey(),
      },
      cache: 'no-store',
    });

    if (response.ok) {
      return (await response.json()) as SupadataTranscriptResponse;
    }

    const body = await response.text();

    if (response.status === 429 && attempt < maxRetries) {
      const retryDelayMs =
        parseRetryAfterMs(response) ?? getRetryBaseDelayMs() * Math.max(1, attempt + 1);
      await sleep(retryDelayMs);
      continue;
    }

    throw new Error(`Supadata transcript request failed with ${response.status}: ${body}`);
  }

  throw new Error('Supadata transcript request exhausted retries.');
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
