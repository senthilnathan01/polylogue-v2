import { BaseAgent } from './base-agent';
import {
  InsightPoint,
  PrimaryVideo,
  SourceAgentOutput,
  Topic,
  TopicResearch,
  TranscriptSegment,
  VideoSource,
} from '../types';
import {
  buildPromptTranscript,
  buildTranscriptExcerpt,
  getTranscriptWithTimestamps,
  searchRelatedVideos,
} from '../services/youtube-service';
import { LLMService } from '../services/llm-service';

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
  constructor(llm: LLMService) {
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
    const candidates = await searchRelatedVideos(topic.search_query, {
      maxResults: 6,
    });

    for (const candidate of candidates) {
      if (usedVideoIds.has(candidate.video_id)) {
        continue;
      }

      if ((candidate.duration_sec ?? 0) > 0 && (candidate.duration_sec ?? 0) < 180) {
        continue;
      }

      const segments = await getTranscriptWithTimestamps(candidate.video_id);
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
    const prompt = `
      Compare how the primary video and the supporting video handle the same topic.

      Topic:
      ${JSON.stringify(topic)}

      Primary video excerpt:
      ${buildTranscriptExcerpt(primaryVideo.transcript_segments, topic.keywords, 3500)}

      Supporting video metadata:
      ${JSON.stringify({
        title: source.title,
        channel: source.channel,
        view_count: source.view_count,
      })}

      Supporting video transcript:
      ${buildPromptTranscript(sourceSegments, {
        chunkSeconds: 180,
        maxChars: 45000,
      })}

      Return valid JSON with this shape:
      {
        "connection_summary": "how this video supports, extends, or challenges the main one",
        "support_takeaways": [{"text": "concrete point", "timestamp_sec": 123}],
        "nuanced_details": [{"text": "specific detail, example, caveat, mechanism, or number", "timestamp_sec": 456}],
        "tensions": [{"text": "genuine disagreement or limitation if present", "timestamp_sec": 789}]
      }

      Rules:
      - Use 3 to 5 support_takeaways.
      - Use 3 to 5 nuanced_details.
      - Use 0 to 3 tensions.
      - Be concrete. Prefer mechanisms, examples, names, numbers, tradeoffs, and caveats.
    `;

    try {
      const data = await this.llm.callJson<SourceAnalysisResponse>(prompt);

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
