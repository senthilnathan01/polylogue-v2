# ADR 0001: Keep The Rebuild TypeScript-First

## Status

Accepted on 2026-03-07.

## Context

The rebuild playbook requires durable jobs, repository abstractions, shared domain contracts, and provider boundaries. Earlier iterations of the product considered Python services, but the active application, deployment model, and contributor surface are already centered on a Next.js and TypeScript codebase.

Reintroducing a second runtime now would increase handoff cost exactly when the architecture is being stabilized. It would also duplicate domain models, prompt/version handling, repository contracts, and provider integrations across languages before the durable storage and worker boundaries are even settled.

## Decision

The product stays TypeScript-first for the rebuild.

That means:

- domain contracts live in shared TypeScript modules
- pipeline orchestration lives in shared TypeScript modules
- provider interfaces and repository interfaces are defined once in TypeScript
- web and future worker runtimes consume the same contract surface
- local adapters may exist temporarily, but they sit behind those TypeScript interfaces

## Consequences

Positive:

- contributors only need one language and one type system to follow core flows
- prompt version metadata, job models, and artifact contracts stay consistent across web and worker code
- the current Next.js runtime can evolve into `apps/web` plus `apps/worker` without a parallel rewrite
- mock repositories and provider fakes can be built against one contract surface

Negative:

- some server-side responsibilities remain colocated with the web app until the worker split lands
- Python-native ecosystem choices are deferred unless they justify a later boundary change

## Follow-up

- move the new `packages/core` and `packages/pipeline` modules into the final monorepo package layout when Agent Packets 2 and 3 introduce durable storage and the worker runtime
- keep updating this ADR if the runtime decision changes before that split
