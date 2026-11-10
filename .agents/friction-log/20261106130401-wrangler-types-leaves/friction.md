---
title: 'wrangler types leaves Durable Object and Workflow bindings untyped without `main`'
severity: 'minor'
target: 'cloudflare/workers-sdk'
---

apps/agents/wrangler.jsonc has no `main` (the Flue Vite plugin serves the entry as a virtual module), so `wrangler types` emits `TEAM_EVENTS: DurableObjectNamespace /* TeamEvents */` and `WORKER_JOB: Workflow /* WorkerJobWorkflow */` with no type arguments. Calling Durable Object RPC methods or `WORKER_JOB.create({ params })` then has no types, so apps/agents/src/env.d.ts re-declares both bindings with `DurableObjectNamespace<TeamEvents>` and `Workflow<WorkerJobParams>`.

Expected: a way to point `wrangler types` at the module that exports the classes (a CLI flag or config key) when `main` is virtual.
