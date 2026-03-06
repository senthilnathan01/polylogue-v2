# Agent Packet 1 Handoff

## Updated folder map

```text
app/
  api/generate/route.ts
  report/[id]/page.tsx
docs/
  PRODUCT_REBUILD_PLAYBOOK.md
  AGENT_PACKET_1_HANDOFF.md
  adr/
    0001-typescript-first-runtime.md
lib/
  providers/
    gemini-llm-provider.ts
    supadata-transcript-provider.ts
    youtube-data-video-provider.ts
  repositories/
    local-json-store.ts
    local-research-repositories.ts
  research-system.ts
  services/
    cache-service.ts
    llm-service.ts
    quota-service.ts
    youtube-service.ts
  pipeline.ts
  types.ts
packages/
  core/
    domain.ts
    pipeline.ts
    providers.ts
    repositories.ts
    transcript-formatting.ts
    youtube.ts
    prompts/
      critic.ts
      extractor.ts
      index.ts
      source-analysis.ts
      synthesizer.ts
      writer.ts
  pipeline/
    index.ts
    run-research-pipeline.ts
    agents/
      base-agent.ts
      critic-agent.ts
      extractor-agent.ts
      source-agent.ts
      synthesizer-agent.ts
      writer-agent.ts
```

## New core interfaces

- `JobRepository`
- `JobEventRepository`
- `ReportRepository`
- `ResearchPackRepository`
- `ArtifactRepository`
- `ExportBundleRepository`
- `UsageCounterRepository`
- `RepositoryBundle`
- `LLMProvider`
- `TranscriptProvider`
- `VideoProvider`
- `PipelineContext`
- `PromptVersion`
- `PromptVersionReference`

## What changed

- Shared domain types moved out of `lib/types.ts` into `packages/core/domain.ts`.
- Prompt text and prompt versions now live in versioned prompt modules under `packages/core/prompts/`.
- Pipeline orchestration moved into `packages/pipeline/run-research-pipeline.ts`.
- The current local JSON runtime remains, but only as a repository adapter in `lib/repositories/local-research-repositories.ts`.
- API and page code now resolve reports and quota through repository/provider abstractions.
- Job events, research packs, artifacts, prompt bundle IDs, and idempotency keys are now modeled and persisted.

## Migration notes and remaining coupling

- Persistence is still backed by `.data/report-store.json`; Packet 2 should replace the local repository adapter with Postgres and storage-backed implementations.
- Streaming is still request-coupled; job events are now recorded, but the browser stream is not replaying from durable events yet. Packet 3 should make SSE read from `JobEventRepository`.
- The repo is not yet split into `apps/web` and `apps/worker`; the current `packages/*` layout is the first boundary, not the final deployment shape.
- Supporting transcript artifacts currently persist source metadata snapshots, not full transcript blobs. Packet 2 should move large transcript bodies into durable artifact storage with metadata rows.
- Quota state is abstracted behind `UsageCounterRepository`, but it still uses the local JSON adapter until durable persistence lands.
