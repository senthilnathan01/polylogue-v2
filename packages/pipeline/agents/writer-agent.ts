import {
  CriticOutput,
  ExtractorOutput,
  LengthType,
  PrimaryVideo,
  SynthesizerOutput,
  TopicResearch,
  WriterOutput,
} from '@/packages/core/domain';
import { buildWriterPrompt } from '@/packages/core/prompts/writer';
import { LLMProvider } from '@/packages/core/providers';

import { BaseAgent } from './base-agent';

export class WriterAgent extends BaseAgent {
  constructor(llm: LLMProvider) {
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
    try {
      const data = await this.llm.callJson<Partial<WriterOutput>>(
        buildWriterPrompt({
          primaryVideo,
          extractorOutput,
          topicResearch,
          synthesizerOutput,
          criticOutput,
          lengthType,
        }),
      );

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
