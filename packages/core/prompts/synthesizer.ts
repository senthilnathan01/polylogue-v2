import {
  ExtractorOutput,
  LengthType,
  PrimaryVideo,
  PromptVersion,
  TopicResearch,
} from '../domain';

export const SYNTHESIZER_PROMPT_VERSION: PromptVersion = {
  id: 'prompt.synthesizer.v1',
  key: 'synthesizer',
  version: '2026-03-07.1',
  label: 'Report plan synthesis',
  description: 'Builds the section plan and writing brief from topic research.',
  created_at: '2026-03-07',
};

export function buildSynthesizerPrompt(input: {
  primaryVideo: PrimaryVideo;
  extractorOutput: ExtractorOutput;
  topicResearch: TopicResearch[];
  lengthType: LengthType;
}): string {
  return `
      Plan a long-form report based on one main YouTube video and a set of supporting videos.

      Primary video:
      ${JSON.stringify({
        title: input.primaryVideo.title,
        channel: input.primaryVideo.channel,
        duration_sec: input.primaryVideo.duration_sec,
        overall_summary: input.extractorOutput.overall_summary,
      })}

      Topics:
      ${JSON.stringify(input.extractorOutput.top_topics)}

      Supporting research:
      ${JSON.stringify(input.topicResearch)}

      Desired length: ${input.lengthType}

      Return valid JSON with this shape:
      {
        "report_title": "title",
        "executive_angle": "one paragraph angle for the full report",
        "section_plan": [
          {
            "heading": "section title",
            "topic_name": "topic name",
            "narrative_goal": "what the section should accomplish",
            "key_points": ["point 1", "point 2"],
            "supporting_videos": ["video title"],
            "nuance_to_preserve": ["caveat or subtle point"]
          }
        ],
        "cross_video_patterns": ["pattern 1"],
        "unanswered_questions": ["question 1"],
        "writing_brief": "brief instructions for the final writer"
      }

      Rules:
      - Keep the main video as the backbone of the report.
      - Supporting videos should deepen or stress-test each topic, not replace the main narrative.
      - Section plan should cover every topic once.
      - Preserve tensions, caveats, and unresolved questions.
    `;
}
