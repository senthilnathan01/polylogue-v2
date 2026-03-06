import { randomUUID } from 'node:crypto';

import { LengthType, Report } from '../types';
import { readStore, updateStore } from './local-store';

const DEFAULT_CACHE_HOURS = 24;

function getCacheWindowMs(): number {
  const hours = Number(process.env.REPORT_CACHE_HOURS ?? DEFAULT_CACHE_HOURS);
  return Number.isFinite(hours) && hours > 0 ? hours * 60 * 60 * 1000 : DEFAULT_CACHE_HOURS * 60 * 60 * 1000;
}

export async function getCachedReport(
  url: string,
  lengthType: LengthType,
): Promise<Report | null> {
  const store = await readStore();
  const newestFirst = [...store.reports].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const cacheWindowMs = getCacheWindowMs();
  const now = Date.now();

  return (
    newestFirst.find((report) => {
      const createdAtMs = new Date(report.created_at).getTime();
      return (
        report.youtube_url === url &&
        report.length_type === lengthType &&
        now - createdAtMs <= cacheWindowMs
      );
    }) ?? null
  );
}

export async function saveReport(
  report: Omit<Report, 'id' | 'created_at' | 'updated_at'>,
): Promise<Report> {
  const timestamp = new Date().toISOString();
  const savedReport: Report = {
    ...report,
    id: randomUUID(),
    created_at: timestamp,
    updated_at: timestamp,
  };

  await updateStore((store) => ({
    ...store,
    reports: [savedReport, ...store.reports.filter((item) => item.id !== savedReport.id)],
  }));

  return savedReport;
}

export async function getReportById(id: string): Promise<Report | null> {
  const store = await readStore();
  return store.reports.find((report) => report.id === id) ?? null;
}
