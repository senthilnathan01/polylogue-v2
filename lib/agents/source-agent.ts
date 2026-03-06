import { BaseAgent } from './base-agent';
import { SourceAgentOutput, Topic, VideoSource } from '../types';
import { searchRelatedVideos, getTranscript } from '../services/youtube-service';
import { LLMService } from '../services/llm-service';

export class SourceAgent extends BaseAgent {
  constructor(llm: LLMService) {
    super(llm);
  }

  async run(topics: Topic[], speaker?: string): Promise<SourceAgentOutput> {
    const sources: VideoSource[] = [];
    
    for (const topic of topics) {
      const query = `${topic.name} technical deep dive`;
      const videos = await searchRelatedVideos(query, 2);
      
      for (const video of videos) {
        const transcript = await getTranscript(video.url);
        if (transcript) {
          const passages = await this.extractPassages(transcript, topic.name);
          sources.push({
            ...video,
            passages,
          });
        }
      }
    }

    if (speaker) {
      const query = `${speaker} talk`;
      const videos = await searchRelatedVideos(query, 2);
      for (const video of videos) {
        const transcript = await getTranscript(video.url);
        if (transcript) {
          const passages = await this.extractPassages(transcript, speaker);
          sources.push({
            ...video,
            passages,
          });
        }
      }
    }

    return { sources };
  }

  private async extractPassages(transcript: string, topic: string): Promise<string[]> {
    const prompt = `
      Extract relevant passages from the following transcript that discuss the topic "${topic}".
      Return a JSON array of strings.
      
      Transcript:
      ${transcript.slice(0, 10000)}... (truncated)
    `;
    
    try {
      const response = await this.llm.call(prompt, "", true);
      return JSON.parse(response);
    } catch (error) {
      console.error("Error extracting passages:", error);
      return [];
    }
  }
}
