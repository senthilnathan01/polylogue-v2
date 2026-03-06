import {
  ArtifactRecord,
  ExportBundle,
  Job,
  JobEvent,
  Report,
  ResearchPack,
} from '@/packages/core/domain';
import { RepositoryBundle } from '@/packages/core/repositories';

import { readLocalStore, updateLocalStore } from './local-json-store';

function now(): string {
  return new Date().toISOString();
}

function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
  return [item, ...items.filter((existing) => existing.id !== item.id)];
}

export function createLocalResearchRepositories(): RepositoryBundle {
  return {
    jobs: {
      async create(job) {
        const timestamp = now();
        const savedJob: Job = {
          ...job,
          created_at: timestamp,
          updated_at: timestamp,
        };

        await updateLocalStore((store) => ({
          ...store,
          jobs: upsertById(store.jobs, savedJob),
        }));

        return savedJob;
      },

      async update(job) {
        const savedJob: Job = {
          ...job,
          updated_at: now(),
        };

        await updateLocalStore((store) => ({
          ...store,
          jobs: upsertById(store.jobs, savedJob),
        }));

        return savedJob;
      },

      async getById(id) {
        const store = await readLocalStore();
        return store.jobs.find((job) => job.id === id) ?? null;
      },

      async findLatestByIdempotencyKey(idempotencyKey) {
        const store = await readLocalStore();
        return (
          [...store.jobs]
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .find((job) => job.idempotency_key === idempotencyKey) ?? null
        );
      },
    },

    jobEvents: {
      async append(event) {
        const savedEvent: JobEvent = {
          ...event,
          created_at: now(),
        };

        await updateLocalStore((store) => ({
          ...store,
          job_events: [...store.job_events, savedEvent].sort((a, b) =>
            a.created_at.localeCompare(b.created_at),
          ),
        }));

        return savedEvent;
      },

      async listByJobId(jobId) {
        const store = await readLocalStore();
        return store.job_events
          .filter((event) => event.job_id === jobId)
          .sort((a, b) => a.sequence - b.sequence);
      },
    },

    reports: {
      async save(report) {
        const savedReport: Report = {
          ...report,
          updated_at: now(),
        };

        await updateLocalStore((store) => ({
          ...store,
          reports: upsertById(store.reports, savedReport),
        }));

        return savedReport;
      },

      async getById(id) {
        const store = await readLocalStore();
        return store.reports.find((report) => report.id === id) ?? null;
      },

      async findLatestByIdempotencyKey(idempotencyKey) {
        const store = await readLocalStore();
        return (
          [...store.reports]
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .find((report) => report.idempotency_key === idempotencyKey) ?? null
        );
      },
    },

    researchPacks: {
      async save(researchPack) {
        const savedResearchPack: ResearchPack = {
          ...researchPack,
          updated_at: now(),
        };

        await updateLocalStore((store) => ({
          ...store,
          research_packs: upsertById(store.research_packs, savedResearchPack),
        }));

        return savedResearchPack;
      },

      async getById(id) {
        const store = await readLocalStore();
        return store.research_packs.find((researchPack) => researchPack.id === id) ?? null;
      },
    },

    artifacts: {
      async save<T>(artifact: ArtifactRecord<T>) {
        const savedArtifact: ArtifactRecord<T> = {
          ...artifact,
          updated_at: now(),
        };

        await updateLocalStore((store) => ({
          ...store,
          artifacts: upsertById(store.artifacts, savedArtifact),
        }));

        return savedArtifact;
      },

      async getById<T>(id: string) {
        const store = await readLocalStore();
        return (store.artifacts.find((artifact) => artifact.id === id) as ArtifactRecord<T>) ?? null;
      },

      async listByResearchPackId(researchPackId) {
        const store = await readLocalStore();
        return store.artifacts.filter((artifact) => artifact.research_pack_id === researchPackId);
      },

      async findLatestByCacheKey<T>(cacheKey: string) {
        const store = await readLocalStore();
        return (
          [...store.artifacts]
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .find((artifact) => artifact.cache_key === cacheKey) as ArtifactRecord<T> | undefined
        ) ?? null;
      },
    },

    exports: {
      async save(bundle) {
        const savedBundle: ExportBundle = {
          ...bundle,
          updated_at: now(),
        };

        await updateLocalStore((store) => ({
          ...store,
          export_bundles: upsertById(store.export_bundles, savedBundle),
        }));

        return savedBundle;
      },

      async getById(id) {
        const store = await readLocalStore();
        return store.export_bundles.find((bundle) => bundle.id === id) ?? null;
      },
    },

    usage: {
      async incrementDailyCount(day) {
        let nextCount = 0;

        await updateLocalStore((store) => {
          nextCount = (store.usageByDate[day] ?? 0) + 1;

          return {
            ...store,
            usageByDate: {
              ...store.usageByDate,
              [day]: nextCount,
            },
          };
        });

        return nextCount;
      },

      async getDailyCount(day) {
        const store = await readLocalStore();
        return store.usageByDate[day] ?? 0;
      },

      async hasSentAlert(day) {
        const store = await readLocalStore();
        return Boolean(store.alertsSentByDate[day]);
      },

      async markAlertSent(day) {
        await updateLocalStore((store) => ({
          ...store,
          alertsSentByDate: {
            ...store.alertsSentByDate,
            [day]: true,
          },
        }));
      },
    },
  };
}
