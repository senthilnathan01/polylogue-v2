import { CriticOutput, PrimaryVideo, SynthesizerOutput, TopicResearch } from '@/packages/core/domain';
import { buildCriticPrompt } from '@/packages/core/prompts/critic';
import { LLMProvider } from '@/packages/core/providers';

import { BaseAgent } from './base-agent';

interface CriticResponse {
  missing_angles?: string[];
  weak_sections?: string[];
  nuance_to_preserve?: string[];
  revision_goals?: string[];
  quality_score?: number;
}

export class CriticAgent extends BaseAgent {
  constructor(llm: LLMProvider) {
    super(llm);
  }

  async run(
    primaryVideo: PrimaryVideo,
    topicResearch: TopicResearch[],
    synthesizerOutput: SynthesizerOutput,
  ): Promise<CriticOutput> {
    try {
      const data = await this.llm.callJson<CriticResponse>(
        buildCriticPrompt({
          primaryVideo,
          topicResearch,
          synthesizerOutput,
        }),
      );

      return {
        missing_angles:
          data.missing_angles?.filter((item): item is string => Boolean(item?.trim())) ?? [],
        weak_sections:
          data.weak_sections?.filter((item): item is string => Boolean(item?.trim())) ?? [],
        nuance_to_preserve:
          data.nuance_to_preserve?.filter((item): item is string => Boolean(item?.trim())) ?? [],
        revision_goals:
          data.revision_goals?.filter((item): item is string => Boolean(item?.trim())) ?? [],
        quality_score: Number(data.quality_score ?? 0),
      };
    } catch (error) {
      console.error('Error critiquing synthesis plan:', error);

      return {
        missing_angles: [],
        weak_sections: [],
        nuance_to_preserve: [],
        revision_goals: [],
        quality_score: 0,
      };
    }
  }
}
