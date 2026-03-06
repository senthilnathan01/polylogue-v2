import { VideoProvider } from '@/packages/core/providers';
import { VideoSource } from '@/packages/core/domain';
import { extractVideoId } from '@/packages/core/youtube';

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

function getYouTubeApiKey(): string {
  const apiKey = process.env.YOUTUBE_DATA_API_KEY;

  if (!apiKey) {
    throw new Error('YOUTUBE_DATA_API_KEY is not set.');
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

  return Number(hours ?? 0) * 3600 + Number(minutes ?? 0) * 60 + Number(seconds ?? 0);
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

export class YouTubeDataVideoProvider implements VideoProvider {
  readonly provider_name = 'youtube-data-api';

  extractVideoId(input: string): string | null {
    return extractVideoId(input);
  }

  async getVideoDetails(urlOrVideoId: string): Promise<VideoSource | null> {
    const videoId = this.extractVideoId(urlOrVideoId);

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

  async searchRelatedVideos(
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
}
