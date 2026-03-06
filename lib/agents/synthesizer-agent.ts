import { BaseAgent } from './base-agent';
import { SynthesizerOutput, Claim, VideoSource, VerifiedClaim, Contradiction, TopicCoverage } from '../types';
import { LLMService } from '../services/llm-service';

export class SynthesizerAgent extends BaseAgent {
  constructor(llm: LLMService) {
    super(llm);
  }

  async run(claims: Claim[], sources: VideoSource[]): Promise<SynthesizerOutput> {
    const verifiedClaims: VerifiedClaim[] = [];
    const contradictions: Contradiction[] = [];
    const topicsCoverage: TopicCoverage[] = [];
    let thinkingNotes = "";

    // Process claims in batches of 5
    for (let i = 0; i < claims.length; i += 5) {
      const batch = claims.slice(i, i + 5);
      const prompt = `
        Verify the following claims using the provided source passages.
        
        Claims:
        ${JSON.stringify(batch)}
        
        Sources:
        ${JSON.stringify(sources.map(s => ({ title: s.title, passages: s.passages })))}
        
        For each claim, determine if it is verified by the sources.
        If verified, provide verification notes.
        If contradicted, provide contradiction details.
        
        Output JSON with:
        "verified_claims": list of verified claims with verification_notes.
        "contradictions": list of contradictions.
        "thinking_notes": summary of reasoning.
      `;
      
      try {
        const response = await this.llm.call(prompt, "", true);
        const data = JSON.parse(response);
        verifiedClaims.push(...data.verified_claims);
        contradictions.push(...data.contradictions);
        thinkingNotes += data.thinking_notes + "\n";
      } catch (error) {
        console.error("Error verifying claims batch:", error);
      }
    }

    return {
      verified_claims: verifiedClaims,
      contradictions,
      topics_coverage: topicsCoverage, // TODO: Implement topic coverage check
      thinking_notes: thinkingNotes,
    };
  }
}
