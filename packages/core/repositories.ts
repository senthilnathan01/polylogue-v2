import {
  ArtifactRecord,
  ExportBundle,
  Job,
  JobEvent,
  Report,
  ResearchPack,
} from './domain';

export interface JobRepository {
  create(job: Omit<Job, 'created_at' | 'updated_at'>): Promise<Job>;
  update(job: Job): Promise<Job>;
  getById(id: string): Promise<Job | null>;
  findLatestByIdempotencyKey(idempotencyKey: string): Promise<Job | null>;
}

export interface JobEventRepository {
  append(event: Omit<JobEvent, 'created_at'>): Promise<JobEvent>;
  listByJobId(jobId: string): Promise<JobEvent[]>;
}

export interface ReportRepository {
  save(report: Report): Promise<Report>;
  getById(id: string): Promise<Report | null>;
  findLatestByIdempotencyKey(idempotencyKey: string): Promise<Report | null>;
}

export interface ResearchPackRepository {
  save(researchPack: ResearchPack): Promise<ResearchPack>;
  getById(id: string): Promise<ResearchPack | null>;
}

export interface ArtifactRepository {
  save<T>(artifact: ArtifactRecord<T>): Promise<ArtifactRecord<T>>;
  getById<T>(id: string): Promise<ArtifactRecord<T> | null>;
  listByResearchPackId(researchPackId: string): Promise<ArtifactRecord[]>;
  findLatestByCacheKey<T>(cacheKey: string): Promise<ArtifactRecord<T> | null>;
}

export interface ExportBundleRepository {
  save(bundle: ExportBundle): Promise<ExportBundle>;
  getById(id: string): Promise<ExportBundle | null>;
}

export interface UsageCounterRepository {
  incrementDailyCount(day: string): Promise<number>;
  getDailyCount(day: string): Promise<number>;
  hasSentAlert(day: string): Promise<boolean>;
  markAlertSent(day: string): Promise<void>;
}

export interface RepositoryBundle {
  jobs: JobRepository;
  jobEvents: JobEventRepository;
  reports: ReportRepository;
  researchPacks: ResearchPackRepository;
  artifacts: ArtifactRepository;
  exports: ExportBundleRepository;
  usage: UsageCounterRepository;
}
