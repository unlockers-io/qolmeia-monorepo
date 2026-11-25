---
title: 'wrangler 4.165 and later breaks the type-aware pass of `fallow dead-code`'
severity: 'major'
target: 'cloudflare/workers-sdk'
---

From wrangler 4.165.0 the `cloudflare` SDK lands in the TypeScript program of apps/agents, and its `_shims/index.d.ts` declares `FileFromPathOptions` twice. From 4.168.0 the generated `worker-configuration.d.ts` also declares `EventSource`, `MessagePort` and `MessageChannel` twice. `tsc --noEmit` hides both because of `skipLibCheck`, but fallow counts them as blocking structural diagnostics, skips its type-aware refinement, and `pnpm fallow:dead` fails on `TeamEvents.broadcast`, `TeamEvents.subscribe` and `WorkerJobWorkflow.run`.

wrangler stays at 4.164.0 until this is fixed.

Expected: declaration files without duplicate identifiers.
