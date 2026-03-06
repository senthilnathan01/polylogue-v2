# Agent Packet 2 Handoff

## ERD summary

- `jobs`
  Stores durable job state, canonical input identity, prompt bundle metadata, and links to the active `research_pack` and final `report`.
- `job_events`
  Append-only event history for each job, ordered by `sequence`.
- `reports`
  Durable final report records keyed by canonical video identity plus prompt bundle through `idempotency_key`.
- `research_packs`
  Structured research artifact records that point at transcript, topic-map, source-selection, synthesis, and critic artifacts.
- `artifacts`
  Typed intermediate outputs. Small artifacts can remain inline; large artifacts like transcripts and exports can be pushed into Supabase Storage with metadata rows here.
- `usage_counters`
  Daily quota and alert state.
- `exports`
  Export bundle records linked to report/research-pack lineage.

## Migration list

- `supabase/migrations/001_initial_schema.sql`
  Legacy prototype tables for `reports` and `daily_usage`.
- `supabase/migrations/002_durable_job_model.sql`
  Adds the durable Packet 2 model, extends the legacy `reports` table, creates the new job/event/artifact/research-pack/export/usage tables, and provisions the storage bucket metadata row.

## Repository method reference

From [`packages/core/repositories.ts`](/Users/tsn/Documents/all_things_python/polylogue-v2/packages/core/repositories.ts):

- `JobRepository.create`
- `JobRepository.update`
- `JobRepository.getById`
- `JobRepository.findLatestByIdempotencyKey`
- `JobEventRepository.append`
- `JobEventRepository.listByJobId`
- `ReportRepository.save`
- `ReportRepository.getById`
- `ReportRepository.findLatestByIdempotencyKey`
- `ResearchPackRepository.save`
- `ResearchPackRepository.getById`
- `ArtifactRepository.save`
- `ArtifactRepository.getById`
- `ArtifactRepository.listByResearchPackId`
- `ArtifactRepository.findLatestByCacheKey`
- `ExportBundleRepository.save`
- `ExportBundleRepository.getById`
- `UsageCounterRepository.incrementDailyCount`
- `UsageCounterRepository.getDailyCount`
- `UsageCounterRepository.hasSentAlert`
- `UsageCounterRepository.markAlertSent`

## Known backfill and cleanup tasks

- There is still no migration that imports legacy `.data/report-store.json` content into Supabase tables. Existing local data remains readable only through the local fallback adapter.
- `job_events` are durable now, but the SSE route still streams from the request lifecycle. Packet 3 should read from `job_events` and add replay semantics.
- Transcript caching now persists reusable transcript artifacts by video ID, but topic extraction/source-selection/synthesis stage reuse is still limited. Packet 4 should expand versioned artifact reuse across more stages.
- The current runtime still lives in one Next.js app. Packet 3 should separate web request creation from the eventual worker/job runner process.
