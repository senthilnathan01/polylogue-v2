# Product Rebuild Playbook

## 0. Purpose

This document is the new source of truth for how to turn the current prototype into a contributor-friendly, production-grade product without losing the core quality bar.

This is not a generic roadmap. It is a sequential implementation plan designed so each major section can be handed to a fresh agent session with minimal additional context.

## 1. Product Definition

### 1.1 What the product is

The product is a research system for long-form technical video content.

The current user entry point is:

1. User submits a YouTube URL.
2. System retrieves the transcript.
3. System extracts major topics from the primary video.
4. System retrieves supporting videos and transcripts.
5. System generates a deep report that preserves nuance and specifics.
6. User receives a stream of incremental output and a durable saved artifact.

### 1.2 What the product is becoming

The long-term product is not only a report generator. It is a structured research artifact generator.

Every run should produce:

- a durable research job record
- a traceable evidence pack
- a final narrative report
- a reusable structured knowledge representation
- optional exports, including Obsidian-ready vault content

### 1.3 Core product principles

- Quality is preserved by transcript fidelity, source traceability, and prompt/versioned audit trails.
- Cost is reduced by eliminating duplicate work, not by weakening reasoning quality.
- Every expensive pipeline stage should produce a reusable artifact.
- Streaming UX should come from durable job events, not a fragile request-bound pipeline.
- The system should be easy for other engineers to extend without rewriting the core.

## 2. Current State Assessment

### 2.1 What is good in the current codebase

- The code already has a typed pipeline and stage model.
- Transcript, LLM, quota, cache, and UI responsibilities are somewhat separated.
- The product direction is already aligned with high-value research output, not shallow summary.
- The current streaming UI proves the desired UX pattern.

### 2.2 What is not acceptable for a real product

- Report generation is still request-coupled.
- Persistence is local-file based and therefore not multi-instance or durable.
- There is no durable job/event model.
- There is no canonical research artifact model.
- Cache reuse is too shallow.
- Agent outputs are not stored as auditable first-class records.
- Error handling is not yet modeled as recoverable job state.
- The current repo is not yet arranged for multi-team or long-term contribution.

### 2.3 What we are explicitly not doing

- We are not re-centering the product around old brainstorm files.
- We are not reintroducing a Python backend just because earlier ideas used FastAPI.
- We are not optimizing cost by downgrading report quality.
- We are not treating Vercel request execution as the long-term home for the core pipeline.

## 3. Target Architecture

### 3.1 Runtime architecture

- `apps/web`: Next.js frontend on Vercel
- `apps/worker`: TypeScript job runner and API service on Railway
- `Supabase Postgres`: durable state, jobs, events, reports, metadata
- `Supabase Storage`: raw transcripts, intermediate research artifacts, exports
- `Redis`: deferred until needed for higher concurrency or lower-latency event fanout

### 3.2 High-level flow

1. Web creates a job.
2. Job enters durable queue state in Postgres.
3. Worker claims the job and runs pipeline stages.
4. Worker persists artifacts and appends sentence-level stream events.
5. Web subscribes to job events over SSE.
6. Final report becomes a durable report record plus structured export bundle.

### 3.3 Architectural rule

Every expensive stage must be replayable, inspectable, and cacheable.

That means the system should not treat the final report as the only important artifact. The following are first-class assets:

- primary transcript
- source transcripts
- topic map
- source selection output
- evidence pack
- final report
- export pack

## 4. Canonical Domain Model

The product should be centered on domain entities, not just UI pages.

Minimum canonical entities:

- `Video`
- `Transcript`
- `TranscriptSegment`
- `Topic`
- `SourceCandidate`
- `SourceSelection`
- `ResearchPack`
- `Claim`
- `Contradiction`
- `Report`
- `Job`
- `JobEvent`
- `ExportBundle`
- `Person`

### 4.1 Key design decision

The `ResearchPack` is the center of the system.

A `ResearchPack` should contain:

- canonical primary video metadata
- primary transcript reference
- normalized topic map
- supporting video selections
- supporting transcript references
- synthesis inputs
- provenance metadata
- prompt version references

Short, medium, and long reports should be renderings of the same `ResearchPack`, not separate full pipeline reruns.

## 5. Repository Target Shape

The current repo can evolve into this shape:

```text
apps/
  web/
  worker/
packages/
  core/
  pipeline/
  providers/
  storage/
  contracts/
  obsidian-export/
infra/
  supabase/
docs/
  PRODUCT_REBUILD_PLAYBOOK.md
```

### 5.1 Package intent

- `packages/core`: domain types, enums, shared validation, version identifiers
- `packages/pipeline`: orchestration of pipeline stages
- `packages/providers`: Supadata, YouTube search, Gemini, future providers
- `packages/storage`: repositories and persistence adapters
- `packages/contracts`: API schemas, job event schemas, SSE payload contracts
- `packages/obsidian-export`: Markdown/wiki-link/canvas export logic

## 6. Sequential Execution Plan

This plan is deliberately ordered. Do not jump to later phases until earlier phases are stable.

---

# Agent Packet 1: Foundation Refactor

## Objective

Create a contributor-grade code foundation that separates domain logic, orchestration, and persistence.

## Why this comes first

Without this, every later feature becomes expensive, fragile, and context-heavy.

## Scope

- introduce durable domain types
- isolate provider interfaces
- isolate repository interfaces
- split app concerns from pipeline concerns
- create versioned prompt/config model

## Required outputs

- `packages/core` or equivalent shared module
- repository interfaces for jobs, reports, artifacts, and stream events
- provider interfaces for transcript retrieval, video metadata/search, and LLM execution
- prompt version registry
- ADR documenting why the repo stays TypeScript-first

## Tasks

1. Define domain models for `Job`, `JobEvent`, `ResearchPack`, `Report`, `ExportBundle`, and `PromptVersion`.
2. Move current shared types out of ad hoc runtime files into a stable domain module.
3. Replace direct file-store assumptions with repository abstractions.
4. Introduce a `PipelineContext` object that carries IDs and references instead of raw blobs wherever possible.
5. Introduce a single source of truth for prompt/version constants.
6. Define canonical ID strategy and idempotency keys.

## Acceptance criteria

- No business logic depends directly on local filesystem storage.
- Pipeline modules can run against mock repositories.
- Prompt versions are addressable and persisted.
- A new contributor can locate provider logic, domain types, and orchestration without searching the whole repo.

## Handoff artifact for next agent

Produce:

- updated folder map
- list of new core interfaces
- migration notes describing what remains coupled

---

# Agent Packet 2: Durable Persistence and Job Model

## Objective

Replace local persistence with a proper durable state model in Supabase/Postgres.

## Why this is second

The product cannot support multi-user usage or resumable streams without durable persistence.

## Scope

- jobs table
- job events table
- reports table
- research packs table
- transcript artifacts
- usage tracking

## Minimum tables

- `jobs`
- `job_events`
- `reports`
- `research_packs`
- `artifacts`
- `usage_counters`
- `exports`

## Data rules

- `jobs` hold state transitions
- `job_events` store append-only stream messages
- `artifacts` store typed intermediate outputs
- large transcripts and exports go to storage with metadata rows in Postgres

## Tasks

1. Design Postgres schema for jobs and artifacts.
2. Add migration set for durable persistence.
3. Implement repositories for jobs, reports, and events.
4. Replace local file store reads/writes.
5. Migrate quota and cache logic to database-backed implementations.
6. Add idempotent lookup on canonical video ID plus prompt version.

## Acceptance criteria

- Multiple app instances can see the same jobs and reports.
- Job state survives restarts and deploys.
- Cached research artifacts can be reused across requests.
- There is no required `.data` runtime dependency.

## Handoff artifact for next agent

Produce:

- ERD summary
- migration list
- repository method reference
- known data backfill or cleanup tasks

---

# Agent Packet 3: Background Job Runner and Streaming Model

## Objective

Move generation off the request lifecycle and keep the ChatGPT-like streaming UX.

## Why this is third

This is the core operational change that unlocks reliability, cost control, and scalable streaming.

## Required behavior

- web request creates job
- worker claims job
- worker appends stream events as it progresses
- web consumes event stream and renders incremental text

## Streaming rule

The UI should stream sentence-level or paragraph-level events, not one final blob.

This must be durable and replayable.

## Tasks

1. Create `POST /jobs` endpoint to create a job.
2. Create `GET /jobs/:id` for job snapshot.
3. Create `GET /jobs/:id/stream` SSE endpoint backed by durable events.
4. Create worker loop to claim pending jobs.
5. Persist pipeline stage updates as event records.
6. Persist writer output in sentence or paragraph increments.
7. Implement reconnect-safe SSE replay from last event ID.

## Important implementation rule

Do not stream directly from volatile in-memory pipeline state only. The stream source must be persistent enough to survive reconnects.

## Acceptance criteria

- Closing and reopening the browser does not lose generation progress.
- A finished job can replay its event stream.
- Long generation no longer depends on Vercel request duration.
- Worker failures leave jobs in recoverable failed states.

## Handoff artifact for next agent

Produce:

- job state machine
- SSE event contract
- worker claim/heartbeat strategy
- failure and retry semantics

---

# Agent Packet 4: Pipeline Recomposition and Cost Control

## Objective

Refactor the current pipeline into reusable, cache-aware stages that minimize cost without reducing output quality.

## Why this is fourth

Once durable jobs exist, we can optimize the actual expensive work.

## Required stage split

- `ingest_primary_video`
- `fetch_primary_transcript`
- `extract_topics`
- `search_supporting_videos`
- `fetch_supporting_transcripts`
- `build_research_pack`
- `render_report`
- `build_exports`

## Cost-control rules

- Transcript artifacts are reused by video ID.
- Source search results are reused for a freshness window.
- Topic extraction is reused by transcript hash plus prompt version.
- Short/medium/long reports render from one research pack.
- Only rerender downstream stages when prompt versions change.

## Tasks

1. Canonicalize video identity and transcript artifact hashing.
2. Refactor extractor, source, synthesizer, critic, and writer into stage functions over artifact references.
3. Persist each stage output separately.
4. Add version-based invalidation.
5. Add selective recomputation logic.
6. Add provenance metadata to every artifact.

## Acceptance criteria

- Running a second report for the same video and different length does not refetch all upstream data.
- A failed writer stage can rerun without rerunning transcript retrieval.
- Cost per repeated request drops significantly while output quality is unchanged.

## Handoff artifact for next agent

Produce:

- stage graph
- cache key design
- recomputation matrix
- artifact versioning map

---

# Agent Packet 5: Product Surfaces and Obsidian Export

## Objective

Turn the system from “report page only” into a research product with exportable knowledge structures.

## Why this is fifth

This is where the product meaningfully extends beyond the current report demo.

## Product surfaces to build

- saved report page
- source traceability view
- research pack inspection view
- export panel
- Obsidian vault export

## Obsidian strategy

Do not export only a single markdown file.

Export a structured vault:

- `00 Index.md`
- `Reports/<report-title>.md`
- `Topics/<topic>.md`
- `Sources/<source-video>.md`
- `People/<person>.md`
- `Claims/<claim-id>.md`
- `Contradictions/<id>.md`
- `Artifacts/research-pack.json`
- `Canvas/research-map.canvas`

## Obsidian content rules

- use wiki links between entities
- add YAML frontmatter to every note
- preserve provenance and source URLs
- include timestamps back to video moments
- include backlinks for graph view
- emit a `.canvas` file for visual relationship mapping

## Tasks

1. Define export bundle schema.
2. Create markdown renderers for report, topic, source, claim, and person notes.
3. Generate wiki-link graph between notes.
4. Generate Obsidian canvas JSON linking topics, sources, claims, and people.
5. Add export job and downloadable bundle output.
6. Add UI to request and download export bundles.

## Acceptance criteria

- A user can download a full Obsidian-ready vault.
- Opening the vault in Obsidian immediately shows connected notes.
- The export derives from structured artifacts, not by reparsing the final report text.

## Handoff artifact for next agent

Produce:

- export schema
- folder structure
- markdown template inventory
- canvas node/edge strategy

---

# Agent Packet 6: Observability, Auditability, and Production Hardening

## Objective

Make the product safe to operate, easy to debug, and trustworthy as a research system.

## Why this is last

Hardening only matters after architecture and core product surfaces exist.

## Audit rules

- every job has immutable event history
- every artifact has provenance
- every prompt has version ID
- every report can be traced back to source transcripts and model inputs

## Required production capabilities

- structured logs
- metrics for job duration and failure rates
- usage dashboards
- per-stage latency measurement
- retry policy by failure class
- dead-letter handling for failed jobs
- admin view for inspecting report lineage

## Tasks

1. Add structured logging with job IDs and stage IDs.
2. Add metrics for transcript retrieval, topic extraction, search latency, render time, and failure counts.
3. Add retry and backoff policy for provider calls.
4. Add admin inspection views for jobs and artifacts.
5. Add smoke tests and end-to-end tests.
6. Add deployment checklists and runbooks.
7. Add contributor docs describing local dev and architecture boundaries.

## Acceptance criteria

- A failed job can be diagnosed without reading raw code.
- Prompt/version drift is visible.
- Provider failures are classified and measurable.
- New contributors can add features without breaking core invariants.

## Handoff artifact for next agent

Produce:

- operational dashboard requirements
- runbook inventory
- test matrix
- contributor onboarding notes

## 7. Cross-Cutting Technical Standards

These rules apply to every agent packet.

### 7.1 State and idempotency

- Every job must be idempotent by canonical input identity and prompt version.
- Every stage must be resumable or rerunnable.
- Cache keys must include versioned dependencies.

### 7.2 Prompt/version control

- Prompts live in versioned files, not inline strings only.
- Every artifact must record prompt ID and model ID.
- Report outputs must be attributable to exact prompt versions.

### 7.3 Data storage rules

- Store metadata in Postgres.
- Store large transcript blobs and export bundles in object storage.
- Reference blobs via stable artifact rows.

### 7.4 Testing rules

- provider contract tests
- repository tests
- pipeline stage tests
- SSE integration tests
- export snapshot tests

### 7.5 Contributor rules

- domain types cannot live only in UI modules
- providers cannot be imported directly by presentation code
- web app cannot own business rules that belong in shared packages or worker services

## 8. Deployment Strategy

### 8.1 Initial production deployment

- Web on Vercel
- Worker/API on Railway
- Supabase for Postgres and storage
- No Redis initially

### 8.2 When to add Redis

Add Redis only when one of these becomes true:

- job throughput makes DB-backed fanout too chatty
- rate limiting needs lower latency
- event replay becomes too expensive from Postgres alone
- you need real-time pub/sub beyond SSE polling semantics

## 9. Immediate Next Step

The next session should start with Agent Packet 1, not random feature work.

Do not begin with:

- auth
- feedback widgets
- public sharing
- more prompt tuning
- Obsidian export

Begin by fixing the architecture base so later work compounds instead of fragmenting.

## 10. Assumptions for Future Sessions

These assumptions were made so work can proceed without reopening old brainstorm files:

- stay TypeScript-first
- keep Vercel for web
- use Railway for background execution
- use Supabase for durable state and storage
- preserve streaming UX
- preserve research quality
- support future Obsidian and structured knowledge exports

If any of those change, update this document first before changing code.
