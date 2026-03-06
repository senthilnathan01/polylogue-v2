import { BaseAgent } from './base-agent';
import { ExtractorOutput, PrimaryVideo, Topic } from '../types';
import { LLMService } from '../services/llm-service';
import { buildPromptTranscript } from '../services/youtube-service';

interface ExtractorResponse {
  overall_summary?: string;
  top_topics?: Array<Partial<Topic>>;
}

export class ExtractorAgent extends BaseAgent {
  constructor(llm: LLMService) {
    super(llm);
  }

  async run(primaryVideo: PrimaryVideo): Promise<ExtractorOutput> {
    const prompt = `
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

    const data = await this.llm.callJson<ExtractorResponse>(prompt);
    const topics = (data.top_topics ?? [])
      .slice(0, 6)
      .map((topic, index) => ({
        name: topic.name?.trim() || `Topic ${index + 1}`,
        summary: topic.summary?.trim() || '',
        importance: topic.importance?.trim() || '',
        search_query: topic.search_query?.trim() || topic.name?.trim() || `Topic ${index + 1}`,
        keywords:
          topic.keywords?.filter((keyword): keyword is string => Boolean(keyword?.trim())) ?? [],
        rank: Number(topic.rank ?? index + 1),
      }))
      .sort((a, b) => a.rank - b.rank);

    if (topics.length < 5) {
      throw new Error('Extractor returned fewer than 5 major topics.');
    }

    return {
      overall_summary: data.overall_summary?.trim() || '',
      top_topics: topics,
    };
  }
}
