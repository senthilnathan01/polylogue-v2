import {
  InsightPoint,
  PrimaryVideo,
  SourceAgentOutput,
  SupportingVideoSelection,
  SupportingVideoSelectionOutput,
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
    const selections = await this.selectSupportingVideos(primaryVideo, topics);
    const transcriptMap = new Map<string, TranscriptSegment[]>();

    for (const selection of selections.selections) {
      if (!selection.source) {
        continue;
      }

      const segments = await this.transcriptProvider.getTranscriptSegments(selection.source.video_id);
      if (segments && segments.length > 0) {
        transcriptMap.set(selection.source.video_id, segments);
      }
    }

    return this.analyzeSelections(primaryVideo, selections, transcriptMap);
  }

  async selectSupportingVideos(
    primaryVideo: PrimaryVideo,
    topics: Topic[],
  ): Promise<SupportingVideoSelectionOutput> {
    const usedVideoIds = new Set<string>([primaryVideo.video_id]);
    const selections: SupportingVideoSelection[] = [];

    for (const topic of topics) {
      const selection = await this.selectSupportingVideo(topic, usedVideoIds);

      if (!selection) {
        selections.push({
          topic,
          source: null,
        });
        continue;
      }

      usedVideoIds.add(selection.video.video_id);
      selections.push({
        topic,
        source: {
          ...selection.video,
          topic_name: topic.name,
          selection_reason: `Selected as the strongest transcript-backed result for "${topic.name}".`,
        },
      });
    }

    return { selections };
  }

  async analyzeSelections(
    primaryVideo: PrimaryVideo,
    selections: SupportingVideoSelectionOutput,
    transcriptSegmentsByVideoId: Map<string, TranscriptSegment[]>,
  ): Promise<SourceAgentOutput> {
    const sources: VideoSource[] = [];
    const topicResearch: TopicResearch[] = [];

    for (const selection of selections.selections) {
      if (!selection.source) {
        topicResearch.push({
          topic: selection.topic,
          source: null,
          connection_summary:
            'No supporting video with an accessible transcript was found for this topic.',
          support_takeaways: [],
          nuanced_details: [],
          tensions: [],
        });
        continue;
      }

      const sourceSegments = transcriptSegmentsByVideoId.get(selection.source.video_id) ?? [];
      const analysis = await this.analyzeSupportingVideo(
        primaryVideo,
        selection.topic,
        selection.source,
        sourceSegments,
      );

      const source: VideoSource = {
        ...selection.source,
        transcript_word_count: sourceSegments
          .map((segment) => segment.text)
          .join(' ')
          .split(/\s+/)
          .filter(Boolean).length,
        transcript_excerpt: buildTranscriptExcerpt(sourceSegments, selection.topic.keywords, 1800),
        research_notes: analysis.connection_summary,
        takeaways: analysis.support_takeaways,
        nuances: analysis.nuanced_details,
        tensions: analysis.tensions,
      };

      sources.push(source);
      topicResearch.push({
        topic: selection.topic,
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
    if (sourceSegments.length === 0) {
      return {
        connection_summary: `This video appears relevant to ${topic.name}, but its transcript could not be reloaded for detailed comparison.`,
        support_takeaways: [],
        nuanced_details: [],
        tensions: [],
      };
    }

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
