import { BaseAgent } from './base-agent';
import { CriticOutput, SynthesizerOutput } from '../types';
import { LLMService } from '../services/llm-service';

export class CriticAgent extends BaseAgent {
  constructor(llm: LLMService) {
    super(llm);
  }

  async run(synthesizerOutput: SynthesizerOutput): Promise<CriticOutput> {
    const prompt = `
      Critique the following synthesizer output.
      
      Synthesizer Output:
      ${JSON.stringify(synthesizerOutput)}
      
      Identify:
      1. Overconfident claims (confidence > 0.8 but weak evidence).
      2. Missed claims (claims in input but not verified).
      3. Missed contradictions (claims that contradict each other).
      4. Suppressed nuance (claims that are too simplified).
      5. Overall quality score (0-100).
      
      Output JSON with:
      "overconfident_claims": list of claim texts.
      "missed_claims": list of claim texts.
      "missed_contradictions": list of contradiction descriptions.
      "suppressed_nuance": list of descriptions.
      "overall_quality_score": number.
    `;
    
    try {
      const response = await this.llm.call(prompt, "", true);
      return JSON.parse(response);
    } catch (error) {
      console.error("Error critiquing synthesizer output:", error);
      return {
        overconfident_claims: [],
        missed_claims: [],
        missed_contradictions: [],
        suppressed_nuance: [],
        overall_quality_score: 0,
      };
    }
  }
}
