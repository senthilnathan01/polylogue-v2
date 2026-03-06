import { PrimaryVideo, PromptVersion } from '../domain';
import { buildPromptTranscript } from '../transcript-formatting';

export const EXTRACTOR_PROMPT_VERSION: PromptVersion = {
  id: 'prompt.extractor.v1',
  key: 'extractor',
  version: '2026-03-07.1',
  label: 'Primary topic extraction',
  description: 'Maps five to six central topics from the primary transcript.',
  created_at: '2026-03-07',
};

export function buildExtractorPrompt(primaryVideo: PrimaryVideo): string {
  return `
      You are analyzing a long-form YouTube video so a research report can be built from it.

      Primary video:
      ${JSON.stringify({
        title: primaryVideo.title,
        channel: primaryVideo.channel,
        duration_sec: primaryVideo.duration_sec,
        transcript_word_count: primaryVideo.transcript_word_count,
      })}

      Timestamped transcript:
      ${buildPromptTranscript(primaryVideo.transcript_segments, {
        chunkSeconds: 240,
        maxChars: 120000,
      })}

      Return valid JSON with this exact shape:
      {
        "overall_summary": "2-4 sentence summary of the video",
        "top_topics": [
          {
            "name": "specific topic name",
            "summary": "what the main video says about the topic",
            "importance": "why this topic matters inside the video",
            "search_query": "natural YouTube search query for one supporting video",
            "keywords": ["keyword 1", "keyword 2", "keyword 3"],
            "rank": 1
          }
        ]
      }

      Rules:
      - Return exactly 5 or 6 topics that together cover the real substance of the video.
      - Topics must be specific enough to search on YouTube.
      - Do not include intro, outro, sponsor, or generic filler topics.
      - Rank 1 must be the most central topic.
      - Keep keywords short and concrete.
    `;
}
