import { google } from 'googleapis';
import { YoutubeTranscript } from 'youtube-transcript';

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_DATA_API_KEY,
});

export function extractVideoId(url: string): string | null {
  const regex = /(?:v=|\/)([0-9A-Za-z_-]{11}).*/;
  const match = url.match(regex);
  if (match) {
    return match[1];
  }
  const shortRegex = /(?:youtu\.be\/)([0-9A-Za-z_-]{11})/;
  const shortMatch = url.match(shortRegex);
  if (shortMatch) {
    return shortMatch[1];
  }
  return null;
}

export async function getTranscript(url: string): Promise<string | null> {
  const videoId = extractVideoId(url);
  if (!videoId) return null;
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    return transcript.map((item) => item.text).join(' ');
  } catch (error) {
    console.error('Error fetching transcript:', error);
    return null;
  }
}

export async function getTranscriptWithTimestamps(url: string): Promise<{ text: string; start: number; duration: number }[] | null> {
  const videoId = extractVideoId(url);
  if (!videoId) return null;
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    return transcript.map((item) => ({
      text: item.text,
      start: item.offset / 1000,
      duration: item.duration / 1000,
    }));
  } catch (error) {
    console.error('Error fetching transcript with timestamps:', error);
    return null;
  }
}

export async function searchRelatedVideos(query: string, maxResults: number = 5): Promise<any[]> {
  try {
    const response = await youtube.search.list({
      q: query,
      part: ['snippet'],
      type: ['video'],
      videoDuration: 'long',
      relevanceLanguage: 'en',
      maxResults: maxResults * 2,
    });

    const items = response.data.items || [];
    const videoIds = items.map((item) => item.id?.videoId).filter((id): id is string => !!id);

    if (videoIds.length === 0) return [];

    const videosResponse = await youtube.videos.list({
      part: ['statistics', 'snippet'],
      id: videoIds,
    });

    const videos = videosResponse.data.items || [];
    const results = [];

    for (const video of videos) {
      const viewCount = parseInt(video.statistics?.viewCount || '0', 10);
      if (viewCount > 10000) {
        const videoId = video.id!;
        // Check if transcript is available
        try {
          await YoutubeTranscript.fetchTranscript(videoId);
          results.push({
            video_id: videoId,
            title: video.snippet?.title || '',
            url: `https://www.youtube.com/watch?v=${videoId}`,
            channel: video.snippet?.channelTitle || '',
            view_count: viewCount,
          });
        } catch (e) {
          // Transcript not available, skip
        }
      }
    }

    results.sort((a, b) => b.view_count - a.view_count);
    return results.slice(0, maxResults);
  } catch (error) {
    console.error('Error searching related videos:', error);
    return [];
  }
}
