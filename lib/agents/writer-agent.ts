import { BaseAgent } from './base-agent';
import { WriterOutput, SynthesizerOutput, CriticOutput, Topic, LengthType } from '../types';
import { LLMService } from '../services/llm-service';

export class WriterAgent extends BaseAgent {
  constructor(llm: LLMService) {
    super(llm);
  }

  async run(synthesizerOutput: SynthesizerOutput, criticOutput: CriticOutput, allTopics: Topic[], lengthType: LengthType): Promise<WriterOutput> {
    const prompt = `
      Write a comprehensive technical report based on the following analysis.
      
      Synthesizer Output:
      ${JSON.stringify(synthesizerOutput)}
      
      Critic Output:
      ${JSON.stringify(criticOutput)}
      
      All Topics:
      ${JSON.stringify(allTopics)}
      
      Length: ${lengthType}
      
      Style: Flowing narrative prose. Technical, detailed, engaging. Like a Hacker News post or technical Substack.
      Do NOT use bullet points. Do NOT structure by timeline.
      Include ALL topics, weaving minor ones naturally.
      Preserve specific technical details (numbers, names, dates).
      Inline citations: [Source: "Video Title", timestamp].
      Flag contradictions: [Note: earlier X stated Y — this appears in tension].
      
      Output JSON with:
      "report_text": The full report text.
      "thinking_text": A summary of reasoning and what was left unsaid.
    `;
    
    try {
      const response = await this.llm.call(prompt, "", true);
      return JSON.parse(response);
    } catch (error) {
      console.error("Error writing report:", error);
      return {
        report_text: "Error generating report.",
        thinking_text: "Error generating thinking text.",
      };
    }
  }

  async *streamReport(synthesizerOutput: SynthesizerOutput, criticOutput: CriticOutput, allTopics: Topic[], lengthType: LengthType): AsyncGenerator<string> {
    const prompt = `
      Write a comprehensive technical report based on the following analysis.
      
      Synthesizer Output:
      ${JSON.stringify(synthesizerOutput)}
      
      Critic Output:
      ${JSON.stringify(criticOutput)}
      
      All Topics:
      ${JSON.stringify(allTopics)}
      
      Length: ${lengthType}
      
      Style: Flowing narrative prose. Technical, detailed, engaging. Like a Hacker News post or technical Substack.
      Do NOT use bullet points. Do NOT structure by timeline.
      Include ALL topics, weaving minor ones naturally.
      Preserve specific technical details (numbers, names, dates).
      Inline citations: [Source: "Video Title", timestamp].
      Flag contradictions: [Note: earlier X stated Y — this appears in tension].
      
      Start writing the report immediately.
    `;
    
    for await (const chunk of this.llm.stream(prompt)) {
      yield chunk;
    }
  }
}
