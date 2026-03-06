import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  ArtifactRecord,
  ExportBundle,
  Job,
  JobEvent,
  Report,
  ResearchPack,
} from '@/packages/core/domain';
import { buildIdempotencyKey } from '@/packages/core/pipeline';

interface LocalStoreShape {
  jobs: Job[];
  job_events: JobEvent[];
  reports: Report[];
  research_packs: ResearchPack[];
  artifacts: ArtifactRecord[];
  export_bundles: ExportBundle[];
  usageByDate: Record<string, number>;
  alertsSentByDate: Record<string, boolean>;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'report-store.json');
const TEMP_FILE = `${STORE_FILE}.tmp`;

const EMPTY_STORE: LocalStoreShape = {
  jobs: [],
  job_events: [],
  reports: [],
  research_packs: [],
  artifacts: [],
  export_bundles: [],
  usageByDate: {},
  alertsSentByDate: {},
};

function hydrateReport(report: Partial<Report>): Report | null {
  if (
    !report.id ||
    !report.youtube_url ||
    !report.length_type ||
    !report.title ||
    !report.primary_video
  ) {
    return null;
  }

  const canonicalVideoId =
    report.canonical_video_id ?? report.primary_video?.video_id ?? 'legacy-unknown-video';
  const promptBundleId = report.prompt_bundle_id ?? 'legacy.inline-prompts';
  const promptVersions = Array.isArray(report.prompt_versions) ? report.prompt_versions : [];
  const createdAt = report.created_at ?? new Date().toISOString();
  const updatedAt = report.updated_at ?? createdAt;

  return {
    id: report.id,
    job_id: report.job_id ?? `legacy-job-${report.id}`,
    research_pack_id: report.research_pack_id ?? `legacy-pack-${report.id}`,
    canonical_video_id: canonicalVideoId,
    idempotency_key:
      report.idempotency_key ??
      buildIdempotencyKey({
        canonical_video_id: canonicalVideoId,
        length_type: report.length_type,
        prompt_bundle_id: promptBundleId,
      }),
    prompt_bundle_id: promptBundleId,
    prompt_versions: promptVersions,
    youtube_url: report.youtube_url,
    length_type: report.length_type,
    title: report.title,
    report_text: report.report_text ?? '',
    thinking_text: report.thinking_text ?? '',
    primary_video: report.primary_video,
    topics: Array.isArray(report.topics) ? report.topics : [],
    sources: Array.isArray(report.sources) ? report.sources : [],
    topic_research: Array.isArray(report.topic_research) ? report.topic_research : [],
    synthesis: report.synthesis ?? {
      report_title: report.title,
      executive_angle: '',
      section_plan: [],
      cross_video_patterns: [],
      unanswered_questions: [],
      writing_brief: '',
    },
    created_at: createdAt,
    updated_at: updatedAt,
    word_count: report.word_count ?? 0,
  };
}

async function ensureStore(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    await readFile(STORE_FILE, 'utf8');
  } catch {
    await writeFile(STORE_FILE, JSON.stringify(EMPTY_STORE, null, 2), 'utf8');
  }
}

export async function readLocalStore(): Promise<LocalStoreShape> {
  await ensureStore();

  try {
    const raw = await readFile(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<LocalStoreShape>;

    return {
      jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
      job_events: Array.isArray(parsed.job_events) ? parsed.job_events : [],
      reports: Array.isArray(parsed.reports)
        ? parsed.reports
            .map((report) => hydrateReport(report))
            .filter((report): report is Report => Boolean(report))
        : [],
      research_packs: Array.isArray(parsed.research_packs) ? parsed.research_packs : [],
      artifacts: Array.isArray(parsed.artifacts) ? parsed.artifacts : [],
      export_bundles: Array.isArray(parsed.export_bundles) ? parsed.export_bundles : [],
      usageByDate:
        parsed.usageByDate && typeof parsed.usageByDate === 'object' ? parsed.usageByDate : {},
      alertsSentByDate:
        parsed.alertsSentByDate && typeof parsed.alertsSentByDate === 'object'
          ? parsed.alertsSentByDate
          : {},
    };
  } catch (error) {
    console.error('Failed to read local store, resetting it.', error);
    await writeLocalStore(EMPTY_STORE);
    return EMPTY_STORE;
  }
}

export async function writeLocalStore(store: LocalStoreShape): Promise<void> {
  await ensureStore();
  await writeFile(TEMP_FILE, JSON.stringify(store, null, 2), 'utf8');
  await rename(TEMP_FILE, STORE_FILE);
}

export async function updateLocalStore(
  updater: (store: LocalStoreShape) => LocalStoreShape | Promise<LocalStoreShape>,
): Promise<LocalStoreShape> {
  const current = await readLocalStore();
  const next = await updater(current);
  await writeLocalStore(next);
  return next;
}
