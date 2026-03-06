import { TranscriptSegment } from './domain';

export function formatTimestamp(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainingSeconds = safe % 60;

  return [hours, minutes, remainingSeconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}

export function buildPromptTranscript(
  segments: TranscriptSegment[],
  options: { chunkSeconds?: number; maxChars?: number } = {},
): string {
  const chunkSeconds = options.chunkSeconds ?? 180;
  const maxChars = options.maxChars ?? 100_000;
  const lines: string[] = [];
  let currentChunkStart = segments[0]?.start ?? 0;
  let currentChunkEnd = currentChunkStart + chunkSeconds;
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length === 0) {
      return;
    }

    lines.push(
      `[${formatTimestamp(currentChunkStart)}-${formatTimestamp(currentChunkEnd)}] ${buffer.join(
        ' ',
      )}`,
    );
    buffer = [];
  };

  for (const segment of segments) {
    if (segment.start >= currentChunkEnd) {
      flush();
      currentChunkStart = segment.start;
      currentChunkEnd = segment.start + chunkSeconds;
    }

    if (segment.text) {
      buffer.push(segment.text);
    }
  }

  flush();

  const transcript = lines.join('\n');
  return transcript.length > maxChars
    ? `${transcript.slice(0, maxChars)}\n...[truncated for prompt size]`
    : transcript;
}

export function buildTranscriptExcerpt(
  segments: TranscriptSegment[],
  keywords: string[],
  maxChars = 1600,
): string {
  const normalizedKeywords = keywords.map((keyword) => keyword.toLowerCase());
  const hits = segments
    .map((segment) => {
      const lower = segment.text.toLowerCase();
      const score = normalizedKeywords.reduce(
        (count, keyword) => count + (lower.includes(keyword) ? 1 : 0),
        0,
      );

      return {
        segment,
        score,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.segment.start - b.segment.start)
    .slice(0, 6)
    .sort((a, b) => a.segment.start - b.segment.start);

  const excerpt = (hits.length > 0 ? hits.map((item) => item.segment) : segments.slice(0, 8))
    .map((segment) => `[${formatTimestamp(segment.start)}] ${segment.text}`)
    .join(' ');

  return excerpt.length > maxChars ? `${excerpt.slice(0, maxChars)}...` : excerpt;
}
