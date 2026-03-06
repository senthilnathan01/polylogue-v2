import { PrimaryVideo, PromptVersion, SynthesizerOutput, TopicResearch } from '../domain';

export const CRITIC_PROMPT_VERSION: PromptVersion = {
  id: 'prompt.critic.v1',
  key: 'critic',
  version: '2026-03-07.1',
  label: 'Plan critique',
  description: 'Reviews the synthesis plan for gaps, weak sections, and nuance loss.',
  created_at: '2026-03-07',
};

export function buildCriticPrompt(input: {
  primaryVideo: PrimaryVideo;
  topicResearch: TopicResearch[];
  synthesizerOutput: SynthesizerOutput;
}): string {
  return `
      Review this report plan before the final draft is written.

      Primary video:
      ${JSON.stringify({
        title: input.primaryVideo.title,
        channel: input.primaryVideo.channel,
        duration_sec: input.primaryVideo.duration_sec,
      })}

      Topic research:
      ${JSON.stringify(input.topicResearch)}

      Report plan:
      ${JSON.stringify(input.synthesizerOutput)}

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
}
