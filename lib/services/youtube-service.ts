import { buildPromptTranscript, buildTranscriptExcerpt, formatTimestamp } from '@/packages/core/transcript-formatting';
import { PrimaryVideo, TranscriptSegment, VideoSource } from '../types';
import { extractVideoId } from '@/packages/core/youtube';
import { getResearchSystem } from '@/lib/research-system';

export { buildPromptTranscript, buildTranscriptExcerpt, extractVideoId, formatTimestamp };

export async function getTranscript(urlOrVideoId: string): Promise<string | null> {
  return getResearchSystem().transcriptProvider.getTranscript(urlOrVideoId);
}

export async function getTranscriptWithTimestamps(
  urlOrVideoId: string,
): Promise<TranscriptSegment[] | null> {
  return getResearchSystem().transcriptProvider.getTranscriptSegments(urlOrVideoId);
}

export async function getVideoDetails(urlOrVideoId: string): Promise<VideoSource | null> {
  return getResearchSystem().videoProvider.getVideoDetails(urlOrVideoId);
}

export async function getPrimaryVideo(url: string): Promise<PrimaryVideo | null> {
  const system = getResearchSystem();
  const videoId = system.videoProvider.extractVideoId(url);

  if (!videoId) {
    return null;
  }

  const [details, transcriptSegments] = await Promise.all([
    system.videoProvider.getVideoDetails(videoId),
    system.transcriptProvider.getTranscriptSegments(videoId),
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
  return getResearchSystem().videoProvider.searchRelatedVideos(query, options);
}
