import { BaseAgent } from './base-agent';
import {
  ExtractorOutput,
  LengthType,
  PrimaryVideo,
  SynthesizerOutput,
  TopicResearch,
} from '../types';
import { LLMService } from '../services/llm-service';

interface SynthesizerResponse {
  report_title?: string;
  executive_angle?: string;
  section_plan?: SynthesizerOutput['section_plan'];
  cross_video_patterns?: string[];
  unanswered_questions?: string[];
  writing_brief?: string;
}

export class SynthesizerAgent extends BaseAgent {
  constructor(llm: LLMService) {
    super(llm);
  }

  async run(
    primaryVideo: PrimaryVideo,
    extractorOutput: ExtractorOutput,
    topicResearch: TopicResearch[],
    lengthType: LengthType,
  ): Promise<SynthesizerOutput> {
    const prompt = `
      Plan a long-form report based on one main YouTube video and a set of supporting videos.

      Primary video:
      ${JSON.stringify({
        title: primaryVideo.title,
        channel: primaryVideo.channel,
        duration_sec: primaryVideo.duration_sec,
        overall_summary: extractorOutput.overall_summary,
      })}

      Topics:
      ${JSON.stringify(extractorOutput.top_topics)}

      Supporting research:
      ${JSON.stringify(topicResearch)}

      Desired length: ${lengthType}

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

    try {
      const data = await this.llm.callJson<SynthesizerResponse>(prompt);

      return {
        report_title: data.report_title?.trim() || primaryVideo.title,
        executive_angle: data.executive_angle?.trim() || extractorOutput.overall_summary,
        section_plan:
          data.section_plan?.map((section, index) => ({
            heading:
              section.heading?.trim() || extractorOutput.top_topics[index]?.name || `Section ${index + 1}`,
            topic_name:
              section.topic_name?.trim() || extractorOutput.top_topics[index]?.name || `Topic ${index + 1}`,
            narrative_goal: section.narrative_goal?.trim() || '',
            key_points:
              section.key_points?.filter((item): item is string => Boolean(item?.trim())) ?? [],
            supporting_videos:
              section.supporting_videos?.filter((item): item is string => Boolean(item?.trim())) ??
              [],
            nuance_to_preserve:
              section.nuance_to_preserve?.filter((item): item is string => Boolean(item?.trim())) ??
              [],
          })) ?? [],
        cross_video_patterns:
          data.cross_video_patterns?.filter((item): item is string => Boolean(item?.trim())) ?? [],
        unanswered_questions:
          data.unanswered_questions?.filter((item): item is string => Boolean(item?.trim())) ?? [],
        writing_brief: data.writing_brief?.trim() || '',
      };
    } catch (error) {
      console.error('Error creating synthesis plan:', error);

      return {
        report_title: primaryVideo.title,
        executive_angle: extractorOutput.overall_summary,
        section_plan: extractorOutput.top_topics.map((topic, index) => ({
          heading: topic.name,
          topic_name: topic.name,
          narrative_goal: topic.summary,
          key_points: [topic.importance],
          supporting_videos: topicResearch[index]?.source ? [topicResearch[index].source!.title] : [],
          nuance_to_preserve: topicResearch[index]?.nuanced_details.map((item) => item.text) ?? [],
        })),
        cross_video_patterns: [],
        unanswered_questions: [],
        writing_brief:
          'Keep the report anchored in the main video while using supporting videos to add specificity and nuance.',
      };
    }
  }
}
