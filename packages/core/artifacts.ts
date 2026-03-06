import { createHash } from 'node:crypto';

import {
  ArtifactRecord,
  LengthType,
  PromptVersionReference,
  TranscriptSegment,
} from './domain';

const DEFAULT_SOURCE_SEARCH_CACHE_HOURS = 24;

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${entries
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

export function hashArtifactContent(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

export function hashTranscriptSegments(segments: TranscriptSegment[]): string {
  return hashArtifactContent(
    segments.map((segment) => ({
      text: segment.text,
      start: segment.start,
      duration: segment.duration,
      end: segment.end,
    })),
  );
}

function formatPromptVersion(promptVersion?: PromptVersionReference): string {
  return promptVersion
    ? `${promptVersion.key}:${promptVersion.version}:${promptVersion.model}`
    : 'prompt:none';
}

export function buildStageCacheKey(...parts: Array<string | number | undefined | null>): string {
  return parts
    .filter((part): part is string | number => part !== undefined && part !== null && part !== '')
    .map((part) => String(part).replace(/\s+/g, '_'))
    .join(':');
}

export function buildPrimaryVideoCacheKey(canonicalVideoId: string): string {
  return buildStageCacheKey('primary_video_metadata', canonicalVideoId);
}

export function buildTranscriptArtifactCacheKey(videoId: string): string {
  return buildStageCacheKey('transcript', videoId);
}

export function buildTopicMapCacheKey(
  transcriptHash: string,
  promptVersion?: PromptVersionReference,
): string {
  return buildStageCacheKey('topic_map', transcriptHash, formatPromptVersion(promptVersion));
}

export function buildSupportingVideoSelectionCacheKey(
  canonicalVideoId: string,
  topicMapHash: string,
): string {
  return buildStageCacheKey('supporting_video_selection', canonicalVideoId, topicMapHash);
}

export function buildSourceSelectionArtifactCacheKey(
  canonicalVideoId: string,
  topicMapHash: string,
  supportingTranscriptSignature: string,
  promptVersion?: PromptVersionReference,
): string {
  return buildStageCacheKey(
    'source_selection',
    canonicalVideoId,
    topicMapHash,
    supportingTranscriptSignature,
    formatPromptVersion(promptVersion),
  );
}

export function buildSynthesisArtifactCacheKey(
  canonicalVideoId: string,
  sourceSelectionHash: string,
  lengthType: LengthType,
  promptVersion?: PromptVersionReference,
): string {
  return buildStageCacheKey(
    'synthesis_plan',
    canonicalVideoId,
    sourceSelectionHash,
    lengthType,
    formatPromptVersion(promptVersion),
  );
}

export function buildCriticArtifactCacheKey(
  canonicalVideoId: string,
  synthesisHash: string,
  promptVersion?: PromptVersionReference,
): string {
  return buildStageCacheKey(
    'critic_notes',
    canonicalVideoId,
    synthesisHash,
    formatPromptVersion(promptVersion),
  );
}

export function buildReportArtifactCacheKey(
  canonicalVideoId: string,
  synthesisHash: string,
  criticHash: string,
  lengthType: LengthType,
  promptVersion?: PromptVersionReference,
): string {
  return buildStageCacheKey(
    'report_markdown',
    canonicalVideoId,
    synthesisHash,
    criticHash,
    lengthType,
    formatPromptVersion(promptVersion),
  );
}

export function buildSupportingTranscriptSignature(artifacts: ArtifactRecord[]): string {
  return hashArtifactContent(
    artifacts.map((artifact) => ({
      id: artifact.id,
      cache_key: artifact.cache_key,
      content_hash: artifact.metadata?.content_hash,
      transcript_hash: artifact.metadata?.transcript_hash,
    })),
  );
}

export function getSourceSearchCacheWindowMs(): number {
  const hours = Number(process.env.SOURCE_SEARCH_CACHE_HOURS ?? DEFAULT_SOURCE_SEARCH_CACHE_HOURS);
  return Number.isFinite(hours) && hours > 0
    ? hours * 60 * 60 * 1000
    : DEFAULT_SOURCE_SEARCH_CACHE_HOURS * 60 * 60 * 1000;
}

export function isArtifactFresh(artifact: ArtifactRecord, maxAgeMs: number): boolean {
  return Date.now() - new Date(artifact.created_at).getTime() <= maxAgeMs;
}
