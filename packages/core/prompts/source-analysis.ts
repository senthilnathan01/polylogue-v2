import { PrimaryVideo, PromptVersion, Topic, TranscriptSegment, VideoSource } from '../domain';
import { buildPromptTranscript, buildTranscriptExcerpt } from '../transcript-formatting';

export const SOURCE_ANALYSIS_PROMPT_VERSION: PromptVersion = {
  id: 'prompt.source-analysis.v1',
  key: 'source_analysis',
  version: '2026-03-07.1',
  label: 'Supporting source comparison',
  description: 'Compares the primary transcript with a supporting transcript per topic.',
  created_at: '2026-03-07',
};

export function buildSourceAnalysisPrompt(input: {
  primaryVideo: PrimaryVideo;
  topic: Topic;
  source: VideoSource;
  sourceSegments: TranscriptSegment[];
}): string {
  return `
      Compare how the primary video and the supporting video handle the same topic.

      Topic:
      ${JSON.stringify(input.topic)}

      Primary video excerpt:
      ${buildTranscriptExcerpt(input.primaryVideo.transcript_segments, input.topic.keywords, 3500)}

      Supporting video metadata:
      ${JSON.stringify({
        title: input.source.title,
        channel: input.source.channel,
        view_count: input.source.view_count,
      })}

      Supporting video transcript:
      ${buildPromptTranscript(input.sourceSegments, {
        chunkSeconds: 180,
        maxChars: 45000,
      })}

      Return valid JSON with this shape:
      {
        "connection_summary": "how this video supports, extends, or challenges the main one",
        "support_takeaways": [{"text": "concrete point", "timestamp_sec": 123}],
        "nuanced_details": [{"text": "specific detail, example, caveat, mechanism, or number", "timestamp_sec": 456}],
        "tensions": [{"text": "genuine disagreement or limitation if present", "timestamp_sec": 789}]
      }

      Rules:
      - Use 3 to 5 support_takeaways.
      - Use 3 to 5 nuanced_details.
      - Use 0 to 3 tensions.
      - Be concrete. Prefer mechanisms, examples, names, numbers, tradeoffs, and caveats.
    `;
}
