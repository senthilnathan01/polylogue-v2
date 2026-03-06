import {
  InsightPoint,
  PrimaryVideo,
  SourceAgentOutput,
  Topic,
  TopicResearch,
  TranscriptSegment,
  VideoSource,
} from '@/packages/core/domain';
import { buildSourceAnalysisPrompt } from '@/packages/core/prompts/source-analysis';
import { TranscriptProvider, VideoProvider } from '@/packages/core/providers';
import { buildTranscriptExcerpt } from '@/packages/core/transcript-formatting';

import { BaseAgent } from './base-agent';

interface SourceAnalysisResponse {
  connection_summary?: string;
  support_takeaways?: Array<{ text?: string; timestamp_sec?: number }>;
  nuanced_details?: Array<{ text?: string; timestamp_sec?: number }>;
  tensions?: Array<{ text?: string; timestamp_sec?: number }>;
}

interface NormalizedSourceAnalysis {
  connection_summary: string;
  support_takeaways: InsightPoint[];
  nuanced_details: InsightPoint[];
  tensions: InsightPoint[];
}

function normalizeInsightPoints(
  points: Array<{ text?: string; timestamp_sec?: number }> | undefined,
  limit: number,
): InsightPoint[] {
  return (points ?? [])
    .filter(
      (item): item is { text: string; timestamp_sec?: number } =>
        typeof item.text === 'string' && item.text.trim().length > 0,
    )
    .slice(0, limit)
    .map((item) => ({
      text: item.text.trim(),
      timestamp_sec: item.timestamp_sec,
    }));
}

export class SourceAgent extends BaseAgent {
  constructor(
    llm: BaseAgent['llm'],
    private readonly videoProvider: VideoProvider,
    private readonly transcriptProvider: TranscriptProvider,
  ) {
    super(llm);
  }

  async run(primaryVideo: PrimaryVideo, topics: Topic[]): Promise<SourceAgentOutput> {
    const sources: VideoSource[] = [];
    const topicResearch: TopicResearch[] = [];
    const usedVideoIds = new Set<string>([primaryVideo.video_id]);

    for (const topic of topics) {
      const selection = await this.selectSupportingVideo(topic, usedVideoIds);

      if (!selection) {
        topicResearch.push({
          topic,
          source: null,
          connection_summary:
            'No supporting video with an accessible transcript was found for this topic.',
          support_takeaways: [],
          nuanced_details: [],
          tensions: [],
        });
        continue;
      }

      usedVideoIds.add(selection.video.video_id);

      const analysis = await this.analyzeSupportingVideo(
        primaryVideo,
        topic,
        selection.video,
        selection.segments,
      );

      const source: VideoSource = {
        ...selection.video,
        topic_name: topic.name,
        selection_reason: `Selected as the strongest transcript-backed result for "${topic.name}".`,
        transcript_word_count: selection.segments
          .map((segment) => segment.text)
          .join(' ')
          .split(/\s+/)
          .filter(Boolean).length,
        transcript_excerpt: buildTranscriptExcerpt(selection.segments, topic.keywords, 1800),
        research_notes: analysis.connection_summary,
        takeaways: analysis.support_takeaways,
        nuances: analysis.nuanced_details,
        tensions: analysis.tensions,
      };

      sources.push(source);
      topicResearch.push({
        topic,
        source,
        connection_summary: analysis.connection_summary,
        support_takeaways: analysis.support_takeaways,
        nuanced_details: analysis.nuanced_details,
        tensions: analysis.tensions,
      });
    }

    return { sources, topic_research: topicResearch };
  }

  private async selectSupportingVideo(
    topic: Topic,
    usedVideoIds: Set<string>,
  ): Promise<{ video: VideoSource; segments: TranscriptSegment[] } | null> {
    const candidates = await this.videoProvider.searchRelatedVideos(topic.search_query, {
      maxResults: 6,
    });

    for (const candidate of candidates) {
      if (usedVideoIds.has(candidate.video_id)) {
        continue;
      }

      if ((candidate.duration_sec ?? 0) > 0 && (candidate.duration_sec ?? 0) < 180) {
        continue;
      }

      const segments = await this.transcriptProvider.getTranscriptSegments(candidate.video_id);
      if (!segments || segments.length < 12) {
        continue;
      }

      return { video: candidate, segments };
    }

    return null;
  }

  private async analyzeSupportingVideo(
    primaryVideo: PrimaryVideo,
    topic: Topic,
    source: VideoSource,
    sourceSegments: TranscriptSegment[],
  ): Promise<NormalizedSourceAnalysis> {
    try {
      const data = await this.llm.callJson<SourceAnalysisResponse>(
        buildSourceAnalysisPrompt({
          primaryVideo,
          topic,
          source,
          sourceSegments,
        }),
      );

      return {
        connection_summary: data.connection_summary?.trim() || '',
        support_takeaways: normalizeInsightPoints(data.support_takeaways, 5),
        nuanced_details: normalizeInsightPoints(data.nuanced_details, 5),
        tensions: normalizeInsightPoints(data.tensions, 3),
      };
    } catch (error) {
      console.error(`Error analyzing supporting video for topic "${topic.name}":`, error);

      return {
        connection_summary: `This video expands on ${topic.name}, but the structured comparison step failed. Use the transcript excerpt as backup context.`,
        support_takeaways: [],
        nuanced_details: [],
        tensions: [],
      };
    }
  }
}
