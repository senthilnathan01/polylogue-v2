# Agent Packet 3 Handoff

## Job state machine

- `pending`
  Job has been created by `POST /api/jobs` and is waiting to be claimed.
- `running`
  The in-process worker loop claimed the job, set `worker_id`, `started_at`, and keeps `last_heartbeat_at` fresh while the pipeline appends durable events.
- `completed`
  Final report and metadata were persisted, terminal events were appended, and `finished_at` was set.
- `failed`
  The worker or pipeline hit a terminal error, persisted the failure event, and set `finished_at`.

## SSE event contract

Stream endpoint: `GET /api/jobs/:id/stream`

Behavior:

- events are sourced from durable `job_events`
- SSE `id:` is the durable event `sequence`
- SSE `event:` is the pipeline stage name
- SSE `data:` is a JSON payload containing stage metadata and/or `text`
- clients can reconnect with `Last-Event-ID` and the stream replays only events with a higher `sequence`
- once the job is terminal and all events have been delivered, the stream closes

## Worker claim and heartbeat strategy

- `POST /api/jobs` creates `pending` jobs only
- `ensureJobWorkerRunning()` starts a singleton in-process polling loop
- the worker claims the oldest pending job through `JobRepository.claimNextPending(workerId)`
- while processing, the worker updates `last_heartbeat_at` on a fixed interval
- the worker stops after an idle window and will be restarted on the next job creation or stream request

## Failure and retry semantics

- pipeline exceptions are converted into durable `failed` job state plus a `failed` job event
- worker-level exceptions also mark the job `failed`
- `POST /api/jobs` reuses non-failed jobs by idempotency key
- if the latest matching job is `failed`, a new job can be created on retry
- cached completed reports can be materialized into replayable completed jobs without rerunning the pipeline

## Remaining coupling

- The worker loop is still in-process inside the web runtime. Packet 4 should not touch that, but the eventual dedicated worker runtime should replace this implementation when the repo is split into `apps/web` and `apps/worker`.
- There is no stale-running-job recovery yet; jobs are recoverable when the worker catches the failure, not when the process dies abruptly.
