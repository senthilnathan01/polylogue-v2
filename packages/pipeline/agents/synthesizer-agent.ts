import {
  ExtractorOutput,
  LengthType,
  PrimaryVideo,
  SynthesizerOutput,
  TopicResearch,
} from '@/packages/core/domain';
import { buildSynthesizerPrompt } from '@/packages/core/prompts/synthesizer';
import { LLMProvider } from '@/packages/core/providers';

import { BaseAgent } from './base-agent';

interface SynthesizerResponse {
  report_title?: string;
  executive_angle?: string;
  section_plan?: SynthesizerOutput['section_plan'];
  cross_video_patterns?: string[];
  unanswered_questions?: string[];
  writing_brief?: string;
}

export class SynthesizerAgent extends BaseAgent {
  constructor(llm: LLMProvider) {
    super(llm);
  }

  async run(
    primaryVideo: PrimaryVideo,
    extractorOutput: ExtractorOutput,
    topicResearch: TopicResearch[],
    lengthType: LengthType,
  ): Promise<SynthesizerOutput> {
    try {
      const data = await this.llm.callJson<SynthesizerResponse>(
        buildSynthesizerPrompt({
          primaryVideo,
          extractorOutput,
          topicResearch,
          lengthType,
        }),
      );

      return {
        report_title: data.report_title?.trim() || primaryVideo.title,
        executive_angle: data.executive_angle?.trim() || extractorOutput.overall_summary,
        section_plan:
          data.section_plan?.map((section, index) => ({
            heading:
              section.heading?.trim() ||
              extractorOutput.top_topics[index]?.name ||
              `Section ${index + 1}`,
            topic_name:
              section.topic_name?.trim() ||
              extractorOutput.top_topics[index]?.name ||
              `Topic ${index + 1}`,
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
