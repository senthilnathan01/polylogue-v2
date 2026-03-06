import {
  CriticOutput,
  ExtractorOutput,
  LengthType,
  PrimaryVideo,
  PromptVersion,
  SynthesizerOutput,
  TopicResearch,
} from '../domain';
import { buildPromptTranscript } from '../transcript-formatting';

const LENGTH_GUIDANCE: Record<LengthType, string> = {
  short: '1800-2400 words',
  medium: '3000-4200 words',
  long: '5000-6500 words',
};

export const WRITER_PROMPT_VERSION: PromptVersion = {
  id: 'prompt.writer.v1',
  key: 'writer',
  version: '2026-03-07.1',
  label: 'Final report writer',
  description: 'Writes the final markdown report and thinking note.',
  created_at: '2026-03-07',
};

export function buildWriterPrompt(input: {
  primaryVideo: PrimaryVideo;
  extractorOutput: ExtractorOutput;
  topicResearch: TopicResearch[];
  synthesizerOutput: SynthesizerOutput;
  criticOutput: CriticOutput;
  lengthType: LengthType;
}): string {
  return `
      Write a highly detailed report in markdown based on one main YouTube video and several supporting videos.

      Main video metadata:
      ${JSON.stringify({
        title: input.primaryVideo.title,
        channel: input.primaryVideo.channel,
        duration_sec: input.primaryVideo.duration_sec,
        transcript_word_count: input.primaryVideo.transcript_word_count,
      })}

      Main video transcript:
      ${buildPromptTranscript(input.primaryVideo.transcript_segments, {
        chunkSeconds: 180,
        maxChars: 120000,
      })}

      Topic map:
      ${JSON.stringify(input.extractorOutput)}

      Supporting topic research:
      ${JSON.stringify(input.topicResearch)}

      Report plan:
      ${JSON.stringify(input.synthesizerOutput)}

      Critic notes:
      ${JSON.stringify(input.criticOutput)}

      Length target: ${LENGTH_GUIDANCE[input.lengthType]}.

      Requirements:
      - The main video is the backbone of the report. Cover its real substance, not just a summary.
      - Supporting videos should expand, sharpen, or challenge the relevant sections, but must not take over the report.
      - Preserve specifics: names, mechanisms, examples, tradeoffs, numbers, caveats, and tensions.
      - Use markdown with an H1 title, H2 section headings, and H3 only when helpful.
      - Prefer paragraphs. Use lists only when they materially improve clarity.
      - End with a section on open questions, unresolved tensions, or edge cases.
      - When drawing from a supporting video, signal it explicitly with the video title and timestamp if one is available in the research notes.

      Return valid JSON:
      {
        "title": "report title",
        "report_text": "# Title\\n\\nFull markdown report...",
        "thinking_text": "Short markdown note describing what the report emphasized, weak spots, and what still needs manual review."
      }
    `;
}
