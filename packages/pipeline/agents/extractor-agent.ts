import { ExtractorOutput, PrimaryVideo, Topic } from '@/packages/core/domain';
import { buildExtractorPrompt } from '@/packages/core/prompts/extractor';
import { LLMProvider } from '@/packages/core/providers';

import { BaseAgent } from './base-agent';

interface ExtractorResponse {
  overall_summary?: string;
  top_topics?: Array<Partial<Topic>>;
}

export class ExtractorAgent extends BaseAgent {
  constructor(llm: LLMProvider) {
    super(llm);
  }

  async run(primaryVideo: PrimaryVideo): Promise<ExtractorOutput> {
    const data = await this.llm.callJson<ExtractorResponse>(buildExtractorPrompt(primaryVideo));
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
