import { BaseAgent } from './base-agent';
import { ExtractorOutput, Topic, Claim } from '../types';
import { LLMService } from '../services/llm-service';

export class ExtractorAgent extends BaseAgent {
  constructor(llm: LLMService) {
    super(llm);
  }

  async run(transcript: string, duration: number): Promise<ExtractorOutput> {
    const prompt = `
      You are an expert podcast analyst. Your task is to extract structured data from the following transcript.
      
      Transcript:
      ${transcript}

      Extract the following information in JSON format:
      1. "all_topics": A list of all topics discussed, ranked by depth (0-100). Depth is the percentage of transcript tokens spent on the topic.
      2. "top_5_topics": The top 5 topics from the list above.
      3. "claims": A list of specific claims made in the podcast. Each claim should have:
         - "text": The claim text.
         - "claim_type": One of "factual", "opinion", "prediction", "anecdotal".
         - "confidence_score": A number between 0 and 1 indicating confidence in the claim's accuracy based on the context.
         - "primary_timestamp_sec": The approximate timestamp in seconds where the claim is made.
      4. "speakers": A list of speaker names identified in the transcript.
      
      Output ONLY valid JSON. No markdown, no preamble.
    `;

    const response = await this.llm.call(prompt, "", true);
    try {
      const data = JSON.parse(response);
      return {
        all_topics: data.all_topics,
        top_5_topics: data.top_5_topics,
        claims: data.claims,
        speakers: data.speakers,
        primary_video_duration_sec: duration,
      };
    } catch (error) {
      console.error("Error parsing extractor output:", error);
      throw new Error("Failed to parse extractor output");
    }
  }
}
