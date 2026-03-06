import { BaseAgent } from './base-agent';
import {
  CriticOutput,
  ExtractorOutput,
  LengthType,
  PrimaryVideo,
  SynthesizerOutput,
  TopicResearch,
  WriterOutput,
} from '../types';
import { LLMService } from '../services/llm-service';
import { buildPromptTranscript } from '../services/youtube-service';

const LENGTH_GUIDANCE: Record<LengthType, string> = {
  short: '1800-2400 words',
  medium: '3000-4200 words',
  long: '5000-6500 words',
};

export class WriterAgent extends BaseAgent {
  constructor(llm: LLMService) {
    super(llm);
  }

  async run(
    primaryVideo: PrimaryVideo,
    extractorOutput: ExtractorOutput,
    topicResearch: TopicResearch[],
    synthesizerOutput: SynthesizerOutput,
    criticOutput: CriticOutput,
    lengthType: LengthType,
  ): Promise<WriterOutput> {
    const prompt = `
      Write a highly detailed report in markdown based on one main YouTube video and several supporting videos.

      Main video metadata:
      ${JSON.stringify({
        title: primaryVideo.title,
        channel: primaryVideo.channel,
        duration_sec: primaryVideo.duration_sec,
        transcript_word_count: primaryVideo.transcript_word_count,
      })}

      Main video transcript:
      ${buildPromptTranscript(primaryVideo.transcript_segments, {
        chunkSeconds: 180,
        maxChars: 120000,
      })}

      Topic map:
      ${JSON.stringify(extractorOutput)}

      Supporting topic research:
      ${JSON.stringify(topicResearch)}

      Report plan:
      ${JSON.stringify(synthesizerOutput)}

      Critic notes:
      ${JSON.stringify(criticOutput)}

      Length target: ${LENGTH_GUIDANCE[lengthType]}.

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

    try {
      const data = await this.llm.callJson<Partial<WriterOutput>>(prompt);

      return {
        title: data.title?.trim() || synthesizerOutput.report_title,
        report_text:
          data.report_text?.trim() ||
          `# ${synthesizerOutput.report_title}\n\nReport generation returned empty output.`,
        thinking_text: data.thinking_text?.trim() || '',
      };
    } catch (error) {
      console.error('Error writing report:', error);

      return {
        title: synthesizerOutput.report_title || primaryVideo.title,
        report_text: `# ${synthesizerOutput.report_title || primaryVideo.title}\n\nThe report generator failed before a final draft could be produced.`,
        thinking_text:
          'The final writing step failed. Review the source notes and rerun the generation.',
      };
    }
  }

  async *streamReport(reportText: string): AsyncGenerator<string> {
    const paragraphs = reportText.split(/\n{2,}/).filter(Boolean);

    for (const paragraph of paragraphs) {
      const chunk = paragraph.endsWith('\n') ? paragraph : `${paragraph}\n\n`;
      yield chunk;
    }
  }
}
