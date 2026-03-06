import { BaseAgent } from './base-agent';
import { CriticOutput, PrimaryVideo, SynthesizerOutput, TopicResearch } from '../types';
import { LLMService } from '../services/llm-service';

interface CriticResponse {
  missing_angles?: string[];
  weak_sections?: string[];
  nuance_to_preserve?: string[];
  revision_goals?: string[];
  quality_score?: number;
}

export class CriticAgent extends BaseAgent {
  constructor(llm: LLMService) {
    super(llm);
  }

  async run(
    primaryVideo: PrimaryVideo,
    topicResearch: TopicResearch[],
    synthesizerOutput: SynthesizerOutput,
  ): Promise<CriticOutput> {
    const prompt = `
      Review this report plan before the final draft is written.

      Primary video:
      ${JSON.stringify({
        title: primaryVideo.title,
        channel: primaryVideo.channel,
        duration_sec: primaryVideo.duration_sec,
      })}

      Topic research:
      ${JSON.stringify(topicResearch)}

      Report plan:
      ${JSON.stringify(synthesizerOutput)}

      Return valid JSON with:
      {
        "missing_angles": ["important idea that would be dropped"],
        "weak_sections": ["section that feels thin or unbalanced"],
        "nuance_to_preserve": ["caveat or tension that must stay visible"],
        "revision_goals": ["clear instruction for the writer"],
        "quality_score": 0
      }

      Rules:
      - Focus on behavioral risk, missing nuance, and imbalance.
      - Prefer concrete revision advice over generic praise.
    `;

    try {
      const data = await this.llm.callJson<CriticResponse>(prompt);

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
