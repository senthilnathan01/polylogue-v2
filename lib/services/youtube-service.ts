import { PrimaryVideo, TranscriptSegment, VideoSource } from '../types';

type YouTubeSearchResponse = {
  items?: Array<{
    id?: { videoId?: string };
  }>;
};

type YouTubeVideoResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      description?: string;
      channelTitle?: string;
      publishedAt?: string;
    };
    statistics?: {
      viewCount?: string;
    };
    contentDetails?: {
      duration?: string;
    };
  }>;
};

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

function getYouTubeApiKey(): string {
  const apiKey = process.env.YOUTUBE_DATA_API_KEY;

  if (!apiKey) {
    throw new Error('YOUTUBE_DATA_API_KEY is not set.');
  }

  return apiKey;
}

function getSupadataApiKey(): string {
  const apiKey = process.env.SUPADATA_API_KEY;

  if (!apiKey) {
    throw new Error('SUPADATA_API_KEY is not set.');
  }

  return apiKey;
}

function parseIsoDuration(value?: string): number {
  if (!value) {
    return 0;
  }

  const match =
    value.match(/P(?:\d+Y)?(?:\d+M)?(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/) ??
    [];
  const [, hours, minutes, seconds] = match;

  return (
    Number(hours ?? 0) * 3600 +
    Number(minutes ?? 0) * 60 +
    Number(seconds ?? 0)
  );
}

async function fetchYouTubeJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`YouTube API request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

export function extractVideoId(input: string): string | null {
  const trimmed = input.trim();

  if (/^[0-9A-Za-z_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname.replace(/^www\./, '');

    if (hostname === 'youtu.be') {
      return parsed.pathname.split('/').filter(Boolean)[0] ?? null;
    }

    if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
      if (parsed.pathname === '/watch') {
        return parsed.searchParams.get('v');
      }

      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') {
        return parts[1] ?? null;
      }
    }
  } catch {
    // Fall through to regex parsing.
  }

  const match = trimmed.match(/([0-9A-Za-z_-]{11})/);
  return match?.[1] ?? null;
}

export function formatTimestamp(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainingSeconds = safe % 60;

  return [hours, minutes, remainingSeconds]
    .map((value, index) =>
      index === 0 ? String(value).padStart(2, '0') : String(value).padStart(2, '0'),
    )
    .join(':');
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

export async function getTranscript(urlOrVideoId: string): Promise<string | null> {
  const segments = await getTranscriptWithTimestamps(urlOrVideoId);
  return segments?.map((segment) => segment.text).join(' ') ?? null;
}

export async function getTranscriptWithTimestamps(
  urlOrVideoId: string,
): Promise<TranscriptSegment[] | null> {
  try {
    const transcript = await fetchSupadataTranscript(urlOrVideoId);
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
    console.error(`Error fetching Supadata transcript for ${urlOrVideoId}:`, error);
    return null;
  }
}

export function buildPromptTranscript(
  segments: TranscriptSegment[],
  options: { chunkSeconds?: number; maxChars?: number } = {},
): string {
  const chunkSeconds = options.chunkSeconds ?? 180;
  const maxChars = options.maxChars ?? 100_000;
  const lines: string[] = [];
  let currentChunkStart = segments[0]?.start ?? 0;
  let currentChunkEnd = currentChunkStart + chunkSeconds;
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length === 0) {
      return;
    }

    lines.push(
      `[${formatTimestamp(currentChunkStart)}-${formatTimestamp(currentChunkEnd)}] ${buffer.join(
        ' ',
      )}`,
    );
    buffer = [];
  };

  for (const segment of segments) {
    if (segment.start >= currentChunkEnd) {
      flush();
      currentChunkStart = segment.start;
      currentChunkEnd = segment.start + chunkSeconds;
    }

    if (segment.text) {
      buffer.push(segment.text);
    }
  }

  flush();

  const transcript = lines.join('\n');
  return transcript.length > maxChars
    ? `${transcript.slice(0, maxChars)}\n...[truncated for prompt size]`
    : transcript;
}

export function buildTranscriptExcerpt(
  segments: TranscriptSegment[],
  keywords: string[],
  maxChars = 1600,
): string {
  const normalizedKeywords = keywords.map((keyword) => keyword.toLowerCase());
  const hits = segments
    .map((segment) => {
      const lower = segment.text.toLowerCase();
      const score = normalizedKeywords.reduce(
        (count, keyword) => count + (lower.includes(keyword) ? 1 : 0),
        0,
      );

      return {
        segment,
        score,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.segment.start - b.segment.start)
    .slice(0, 6)
    .sort((a, b) => a.segment.start - b.segment.start);

  const excerpt = (hits.length > 0 ? hits.map((item) => item.segment) : segments.slice(0, 8))
    .map((segment) => `[${formatTimestamp(segment.start)}] ${segment.text}`)
    .join(' ');

  return excerpt.length > maxChars ? `${excerpt.slice(0, maxChars)}...` : excerpt;
}

export async function getVideoDetails(urlOrVideoId: string): Promise<VideoSource | null> {
  const videoId = extractVideoId(urlOrVideoId);

  if (!videoId) {
    return null;
  }

  try {
    const apiKey = getYouTubeApiKey();
    const url =
      'https://www.googleapis.com/youtube/v3/videos' +
      `?part=snippet,statistics,contentDetails&id=${videoId}&key=${apiKey}`;
    const data = await fetchYouTubeJson<YouTubeVideoResponse>(url);
    const video = data.items?.[0];

    if (!video?.id) {
      return null;
    }

    return {
      video_id: video.id,
      title: video.snippet?.title ?? 'Untitled video',
      url: `https://www.youtube.com/watch?v=${video.id}`,
      channel: video.snippet?.channelTitle ?? 'Unknown channel',
      view_count: Number(video.statistics?.viewCount ?? 0),
      published_at: video.snippet?.publishedAt,
      description: video.snippet?.description ?? '',
      duration_sec: parseIsoDuration(video.contentDetails?.duration),
    };
  } catch (error) {
    console.error(`Error fetching video details for ${videoId}:`, error);
    return {
      video_id: videoId,
      title: 'YouTube video',
      url: `https://www.youtube.com/watch?v=${videoId}`,
      channel: 'Unknown channel',
      view_count: 0,
    };
  }
}

export async function getPrimaryVideo(url: string): Promise<PrimaryVideo | null> {
  const videoId = extractVideoId(url);

  if (!videoId) {
    return null;
  }

  const [details, transcriptSegments] = await Promise.all([
    getVideoDetails(videoId),
    getTranscriptWithTimestamps(videoId),
  ]);

  if (!details || !transcriptSegments || transcriptSegments.length === 0) {
    return null;
  }

  const transcript = transcriptSegments.map((segment) => segment.text).join(' ');
  const durationFromTranscript = transcriptSegments[transcriptSegments.length - 1]?.end ?? 0;

  return {
    video_id: details.video_id,
    title: details.title,
    url: details.url,
    channel: details.channel,
    view_count: details.view_count,
    published_at: details.published_at,
    duration_sec: details.duration_sec && details.duration_sec > 0 ? details.duration_sec : durationFromTranscript,
    description: details.description,
    transcript,
    transcript_segments: transcriptSegments,
    transcript_word_count: transcript.split(/\s+/).filter(Boolean).length,
  };
}

export async function searchRelatedVideos(
  query: string,
  options: { maxResults?: number; excludeVideoId?: string } = {},
): Promise<VideoSource[]> {
  const maxResults = options.maxResults ?? 6;
  const apiKey = getYouTubeApiKey();

  const searchUrl =
    'https://www.googleapis.com/youtube/v3/search' +
    `?part=snippet&type=video&q=${encodeURIComponent(query)}` +
    `&maxResults=${Math.min(maxResults * 2, 12)}` +
    '&order=relevance&videoEmbeddable=true&videoSyndicated=true&key=' +
    apiKey;
  const searchData = await fetchYouTubeJson<YouTubeSearchResponse>(searchUrl);
  const orderedIds = (searchData.items ?? [])
    .map((item) => item.id?.videoId)
    .filter((value): value is string => Boolean(value))
    .filter((value) => value !== options.excludeVideoId);

  if (orderedIds.length === 0) {
    return [];
  }

  const detailsUrl =
    'https://www.googleapis.com/youtube/v3/videos' +
    `?part=snippet,statistics,contentDetails&id=${orderedIds.join(',')}&key=${apiKey}`;
  const detailsData = await fetchYouTubeJson<YouTubeVideoResponse>(detailsUrl);
  const rankMap = new Map(orderedIds.map((id, index) => [id, index]));

  return (detailsData.items ?? [])
    .filter((item) => item.id && item.id !== options.excludeVideoId)
    .map((item) => ({
      video_id: item.id ?? '',
      title: item.snippet?.title ?? 'Untitled video',
      url: `https://www.youtube.com/watch?v=${item.id}`,
      channel: item.snippet?.channelTitle ?? 'Unknown channel',
      view_count: Number(item.statistics?.viewCount ?? 0),
      published_at: item.snippet?.publishedAt,
      description: item.snippet?.description ?? '',
      duration_sec: parseIsoDuration(item.contentDetails?.duration),
    }))
    .filter((item) => item.video_id)
    .sort((a, b) => {
      const rankDiff =
        (rankMap.get(a.video_id) ?? Number.MAX_SAFE_INTEGER) -
        (rankMap.get(b.video_id) ?? Number.MAX_SAFE_INTEGER);

      if (rankDiff !== 0) {
        return rankDiff;
      }

      return b.view_count - a.view_count;
    })
    .slice(0, maxResults);
}
