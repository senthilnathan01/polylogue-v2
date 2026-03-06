import { ACTIVE_PROMPT_VERSIONS, buildIdempotencyKey, buildPromptBundleId } from '@/packages/core';
import { getResearchSystem } from '@/lib/research-system';
import { LengthType, Report } from '../types';

const DEFAULT_CACHE_HOURS = 24;

function getCacheWindowMs(): number {
  const hours = Number(process.env.REPORT_CACHE_HOURS ?? DEFAULT_CACHE_HOURS);
  return Number.isFinite(hours) && hours > 0 ? hours * 60 * 60 * 1000 : DEFAULT_CACHE_HOURS * 60 * 60 * 1000;
}

export async function getCachedReport(
  url: string,
  lengthType: LengthType,
): Promise<Report | null> {
  const system = getResearchSystem();
  const canonicalVideoId = system.videoProvider.extractVideoId(url);

  if (!canonicalVideoId) {
    return null;
  }

  const promptBundleId = buildPromptBundleId(ACTIVE_PROMPT_VERSIONS);
  const idempotencyKey = buildIdempotencyKey({
    canonical_video_id: canonicalVideoId,
    length_type: lengthType,
    prompt_bundle_id: promptBundleId,
  });

  const report = await system.repositories.reports.findLatestByIdempotencyKey(idempotencyKey);

  if (!report) {
    return null;
  }

  const cacheWindowMs = getCacheWindowMs();
  const now = Date.now();

  return now - new Date(report.created_at).getTime() <= cacheWindowMs ? report : null;
}

export async function saveReport(
  report: Report,
): Promise<Report> {
  return getResearchSystem().repositories.reports.save(report);
}

export async function getReportById(id: string): Promise<Report | null> {
  return getResearchSystem().repositories.reports.getById(id);
}
