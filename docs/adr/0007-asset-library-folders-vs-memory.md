# Asset library: customer/agent folders, kept separate from agent memory

> **Status (2026-10): amended.** The three stores stand. What changed:
>
> - Postgres, not D1, holds the `asset` and `memory_fact` rows, and the Worker reaches it directly ([ADR 0010](./0010-worker-reaches-postgres-through-hyperdrive.md)). "Postgres is auth-only" below is no longer true; Memory stays on Vectorize for recall, with the `memory_fact` row as the authority (`memory/memory.ts`).
> - The folder lives only in `visibility`. Objects are not moved under `customer/` / `agent/` prefixes: new keys are `org_<companyId>/<assetId>.<ext>` and older objects keep their stored key (`library/assets.ts`).
> - A Worker job writes its deliverable to the agent folder; the Action type's executor promotes it to the customer folder when the Action executes ([ADR 0006](./0006-approval-gates-only-high-impact-actions.md)). Blanket `knowledge_doc` capture is gone.
> - Brand identity is the `brand_asset` kind in the customer folder, not a `brand/` subfolder.

`/assets` started as one shared pile that conflated three different things: files the customer should see, working material only the agents need, and "things the agent should remember." Auto-capture made it worse by dumping _every_ Worker text deliverable in as a `knowledge_doc`.

**Decision:** there are **three distinct stores**, and we stop merging them.

## 1. Library — files in R2, split into two folders per Company

- **`customer` folder** — visible to the customer _and_ the agents. Finished deliverables and the customer's own uploads live here.
  - Contains a **`brand/` subfolder** = brand identity (logo, palette, references). The "Identidade da Marca" settings section writes here; this is today's `brand_asset` kind.
- **`agent` folder** — agent-only working material: raw `fetchUrl` scrapes, intermediate drafts, scratch files. The customer never sees it.
- Assets gain a **`visibility`** field (`customer` | `agent`). `/api/me/assets` returns only `customer`; the agent skills (`listAssets`/`readAsset`/`saveAsset`) reach both. The row is the authority: the folder lives only in `visibility`, R2 keys are `org_<companyId>/<assetId>.<ext>`, and promotion to the customer folder is a single row update. Objects stored before this change keep their stored `r2Key`.

## 2. Memory — semantic facts, not files

Important information the agent saves on purpose and recalls semantically. **This already exists**: `rememberFact` / `recallMemory` over the Memory module in `apps/agents/src/memory/` (`in-memory` for dev and tests, `vectorize` everywhere else). It stays on **Cloudflare Vectorize**, not pgvector — the D1/R2 Worker has no Postgres connection (Postgres is auth-only), and the adapter keeps a future swap cheap. Memory is not the library; a fact is not a file.

## 3. Capture policy — curated, not blanket

- A finished **deliverable** → the **customer** folder.
- **Working material** (scrapes, drafts) → the **agent** folder.
- "This is important, remember it" → **memory** via `rememberFact`.
- Drop the blanket auto-capture that turns every Worker text reply into a `knowledge_doc`.

## Consequences

- The `asset` table needs a `visibility` column; existing rows + R2 keys migrate under `customer/` / `agent/` prefixes.
- `worker-job`'s `captureDeliverable` (blanket `knowledge_doc`) is reworked to the curated model (or removed); `saveAsset` takes a target folder; `listAssets`/`readAsset` can scope by folder.
- "Canais" in the Brief must carry a **URL per selected channel** — bare checkboxes are meaningless without the link. Tracked for when the Brief form is next touched.
