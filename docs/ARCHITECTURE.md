# Qolmeia: Architecture Overview

## §1. What Qolmeia is

Qolmeia is a **vertical-agnostic agent platform sold as a product**: a customer signs up, is interviewed by an onboarding agent, confirms a "Team" of specialist agents, and from then on chats with a single point-of-contact agent that delegates real work to those specialists. High-impact actions pause for an internal operator to approve before they execute. The first vertical shipped is a marketing agency (Designer, Marketing Strategist, Redator, SEO Researcher); the platform is built to host other verticals (e.g. Cobrança) without code forks; see [ADR 0009](adr/0009-vertical-agnostic-agent-platform.md).

User-facing locale is **pt-BR** across every agent and UI.

## §2. The system at a glance

```
                 ┌──────────────────────────┐        ┌───────────────────────────┐
  CUSTOMER ─────▶│ apps/web (Next 16)       │        │ apps/backoffice (Next 16) │◀──── OWNER / STAFF
                 │ app.qolmeia.com · chat   │        │ admin.qolmeia.com         │
                 └────────────┬─────────────┘        └─────────────┬─────────────┘
         rewrites (same-origin,│ host-only cookie)                 │ rewrites
   /api/auth/*, /api/me/*,     │                                   │ /api/auth/*,
   /api/teams/*, /agents/*,    │                                   │ /api/backoffice/*,
   /assets/:id                 │                                   │ /assets/:id
                 ┌─────────────▼───────────────────────────────────▼─────────────┐
                 │  apps/agents  "worker-bees"  (Cloudflare Worker, Flue)          │
                 │  agents.qolmeia.com                                             │
                 │   • Better Auth (/api/auth/*) and the identity module           │
                 │   • Flue agents (Durable Objects): Planner · Correspondent      │
                 │   • WorkerJobWorkflow (Cloudflare Workflow, approval gate)      │
                 │   • REST: /api/me /api/teams /api/backoffice /assets            │
                 └────────────────────────────────┬────────────────────────────────┘
                                                  ▼
               Postgres on Railway (via Hyperdrive) · R2 · Vectorize · AI Gateway
```

Four deployables in one Turborepo: the Worker (Cloudflare, deployed by hand) and three Next apps (Vercel, deployed on merge to `main`; `apps/landing` is a static marketing site that talks to nothing). The **Worker is the whole backend**: it hosts Better Auth ([ADR 0011](adr/0011-worker-hosts-better-auth.md)) and owns all product data ([ADR 0010](adr/0010-worker-reaches-postgres-through-hyperdrive.md)). The browser never calls the Worker's host; each Next app rewrites the Worker routes it needs onto its own origin, so every session cookie is host-only on its app, in dev (`.localhost` is a public suffix) and in prod alike. Railway hosts only Postgres.

## §3. Repo layout

Monorepo: pnpm 11 workspaces + Turborepo, Node 24.

### Apps

| Folder            | Package       | Framework         | Dev URL (portless)                     | Audience                |
| ----------------- | ------------- | ----------------- | -------------------------------------- | ----------------------- |
| `apps/agents`     | `worker-bees` | Cloudflare Worker | `https://qolmeia.agents.localhost`     | The backend             |
| `apps/web`        | `web`         | Next.js 16        | `https://qolmeia.web.localhost`        | Customers (CUSTOMER)    |
| `apps/backoffice` | `backoffice`  | Next.js 16        | `https://qolmeia.backoffice.localhost` | Operators (OWNER/STAFF) |
| `apps/landing`    | `landing`     | Next.js 16        | `https://qolmeia.landing.localhost`    | Public marketing site   |

`vite dev` binds the Worker to `127.0.0.1:8787`, the address the Next rewrites and server helpers use by default (`AGENTS_INTERNAL_URL`).

### Packages

| Package                   | Purpose                                                                                            |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| `@repo/auth`              | `createAuth` factory over Better Auth, hosted by the Worker; session-cookie and client-IP helpers. |
| `@repo/db`                | Prisma schema, Node and Cloudflare Worker client entry points, default template seed.              |
| `@repo/worker-api`        | Typed Worker client and the request/response contracts (roles, surfaces, action types, brief).     |
| `@repo/app-shell`         | Next glue shared by web and backoffice: `createNextConfig`, `createProxy`, session helpers.        |
| `@repo/transactional`     | React Email templates + Resend sender (rendered in the Worker).                                    |
| `@repo/ui`                | shadcn-style component library + Tailwind preset shared by the Next apps.                          |
| `@repo/social-image`      | Open Graph image text rendering for the Next apps.                                                 |
| `@repo/observability`     | Structured logging helpers.                                                                        |
| `@repo/portless-env`      | Fills dev URL env vars from `portless get`.                                                        |
| `@repo/config-vitest`     | Shared Vitest config.                                                                              |
| `@repo/typescript-config` | Shared tsconfig bases (`moduleResolution: Bundler`).                                               |

## §4. Runtime topology & data stores

The Worker owns every store. Each has a single purpose:

| Store               | Binding                       | Holds                                                                                                          |
| ------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Postgres**        | `HYPERDRIVE`                  | System of record for auth and product data, through Prisma's `cloudflare` client (ADR 0010).                   |
| **R2**              | `ASSETS`                      | Asset bytes, keyed `org_<companyId>/<assetId>.<ext>`. The `asset` row decides access; served at `/assets/:id`. |
| **Vectorize**       | `VECTORIZE` + `AI`            | Embeddings for Memory recall. Required unless `MEMORY_BACKEND=in-memory` (`vite dev` and tests).               |
| **Durable Objects** | Flue-generated, `TEAM_EVENTS` | Conversation state of the Planner and Correspondent (a rebuildable cache, ADR 0002); live roster events.       |
| **Workflows**       | `WORKER_JOB`                  | `WorkerJobWorkflow` runs: the durable generate → propose → decide → execute loop for delegated work.           |

Every model call goes through **Cloudflare AI Gateway** to OpenRouter (§6, Provider). A weekly cron (`0 13 * * 1`) runs the proactive sweep (§8).

## §5. Data model (Prisma/Postgres)

Schema in [`packages/db/prisma/schema.prisma`](../packages/db/prisma/schema.prisma). The idempotent seed in [`packages/db/src/product-seed.ts`](../packages/db/src/product-seed.ts) owns the default worker templates. Better Auth owns `User`, `Session`, `Account`, `Verification`, `RateLimit`, `Organization`, and `OrgMembership`; an organization id is reused as the product company id. Product tables:

| Table                          | Purpose                                                                                                                                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `company`                      | The tenant. `status: onboarding \| active \| paused`, `brief` (JSON, the AI-extracted business profile), slug, locale, timezone.                                                                                  |
| `template`                     | System-defined agent blueprint. `worker_kind`, `system_prompt`, `model` (OpenRouter id), `skill_ids`, `default_action_type`, `default_policies`, `status`.                                                        |
| `company_template_entitlement` | Which templates a company may hire.                                                                                                                                                                               |
| `agent_instance`               | A hired agent for a company. `role: correspondent \| planner \| worker`, `template_id`, `prompt_override?`, `status`.                                                                                             |
| `team` / `team_member`         | The confirmed roster. `team_member.can_delegate_to` (JSON) encodes the delegation graph.                                                                                                                          |
| `ticket`                       | A unit of delegated work. `status: open \| in_progress \| awaiting_approval \| blocked \| done \| cancelled \| rejected`, `origin`, `brief`, `workflow_id`, `result`.                                             |
| `action`                       | The effect a Ticket proposes, one per round (id `<ticketId>-r<round>`). `action_type`, `policy`, `proposed` (JSON), `status: pending \| approved \| changes_requested \| rejected \| executed`, decision fields.  |
| `memory_fact`                  | Long-term agent memory: the authority for a fact. `kind`, `content`; its vector lives in Vectorize.                                                                                                               |
| `asset`                        | R2 object metadata. `kind` (`generated_image`/`brand_asset`/`user_upload`/`knowledge_doc`/`audio`), `mime`, `visibility` (the folder: `customer` \| `agent`), `r2_key`, SHA-256.                                  |
| `skill`                        | Operator kill-switch only: `id`, `enabled`. A missing row means enabled.                                                                                                                                          |
| `activity_log`                 | Append-only pt-BR timeline, written in the same transaction as the change it records. `type` strings are stable; the backoffice categorises by prefix (`ACTION_*`, `TICKET_*`, `WORKER_*`, `TEAM_*`, `MEMBER_*`). |
| `operator_assignment`          | Which Companies and disciplines an Operator covers.                                                                                                                                                               |

Product data lives in domain modules under `apps/agents/src/` (`team/`, `ticket/`, `action/`, `company/`, `library/`, `memory/`, `activity/`, `template/`, `operator/`). Each use case is one interactive transaction; `lib/db.ts` opens a short-lived client per request, Workflow step, or skill call.

## §6. The agent layer (Flue)

The two conversational agents run on **[Flue](https://flueframework.com)** 2, a Claude-Code-style harness (sessions, tool loop, compaction) on Cloudflare. Each agent is a `'use agent'` function under [`apps/agents/src/agents/`](../apps/agents/src/agents). Its exported function name determines the generated Durable Object class and storage identity, so renames require an explicit `agentName` pin. ADR 0004 ("Flue rejected") is superseded by the 2026-06 decision to adopt Flue.

| Agent             | Instance key | Role                                                                                                                            |
| ----------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **Planner**       | companyId    | Onboarding interview. Extracts the brief (`extractBrief`) and proposes a Team (`proposeTeam`); the customer confirms in the UI. |
| **Correspondent** | companyId    | The customer's single point of contact once active. Uses memory, manages assets, and delegates work (`delegateToWorker`).       |

Template-defined specialists are not conversational Flue agents. `delegateToWorker` creates a ticket and starts `WorkerJobWorkflow`, which resolves the specialist's template and generates the deliverable with AI SDK `generateText`.

**Build & routing.** Vite runs the `flue()` plugin before the Cloudflare plugin and merges Flue's generated entry and bindings through `flueWorkerConfig()`. [`src/app.ts`](../apps/agents/src/app.ts) mounts Better Auth, the REST routes, and `CorrespondentV2` and `PlannerV2` with `createAgentRouter`. [`src/cloudflare.ts`](../apps/agents/src/cloudflare.ts) exports `WorkerJobWorkflow`, `TeamEvents`, and the scheduled handler. `vite build` emits `FlueCorrespondentV2Agent` and `FluePlannerV2Agent` alongside those app-owned exports, and `wrangler deploy` consumes the generated deployment config. The Durable Object migrations `v1`–`v3` live in `wrangler.jsonc`. The repo uses Node `#/*` subpath imports (not a tsconfig path alias).

**Transport.** Agents are HTTP+SSE, not WebSocket:

- `POST /agents/:name/:id` with `{ "kind": "user", "body": string, "attachments"?: [...] }` → 202 `{ streamUrl, submissionId }` (a durable submission).
- `GET /agents/:name/:id?view=history` returns the conversation snapshot; `?view=updates` is the SSE stream. Events are durably stored and replayable from any offset, so clients resume from checkpoints.
- Server code reaches an agent with `dispatch(AgentFunction, { id, message })`, always as a `kind: "signal"` message (deliverable delivery, verdict updates, the proactive sweep). Flue marks signals `display: "diagnostic"`, and the client hides them.

**Auth gate.** `src/app.ts` puts `requireCustomerOfPathTenant` before both agent routers: a signed-in **CUSTOMER** only, and the `:id` path segment must equal the session's companyId (tenant isolation, [ADR 0001](adr/0001-tenant-isolation-on-agent-path.md)).

**Provider.** [`src/lib/models.ts`](../apps/agents/src/lib/models.ts) is the only place the model table, the gateway URL, and `OPENROUTER_API_KEY` appear. It supplies the Flue provider (pi-ai's OpenRouter provider with the gateway as its base URL), the Workflow's AI SDK model, and the image-generation request, and sends all three to `https://gateway.ai.cloudflare.com/v1/<account>/<gateway>/openrouter/v1`. The Correspondent and Planner use one conversation model; specialist models are set per template.

## §7. Skills catalog

A skill is one module: `defineSkill({ id, displayName, description, inputSchema (zod), execute(input, ctx) })`, listed in `ALL_SKILLS` in [`apps/agents/src/skills/registry.ts`](../apps/agents/src/skills/registry.ts). The registry derives from it the Flue tool (zod → JSON Schema → Valibot in `lib/skill-tool.ts`; Flue validates tool input with Valibot only), the AI SDK tool for Workflow runs, and the backoffice catalog entry. The `skill` table only stores the operator kill-switch, read once per agent turn and once per generation step. 12 today:

`rememberFact` · `recallMemory` · `delegateToWorker` · `generateBrandImage` · `draftSocialPost` · `extractBrief` · `proposeTeam` · `listAssets` · `readAsset` · `saveAsset` · `webSearch` · `fetchUrl`

A template's `skillIds` selects which tools the Workflow exposes while generating that specialist's deliverable; the Correspondent and Planner have fixed sets. Worker kinds seeded today: `designer`, `marketing-strategist`, `redator`, and `seo-researcher`. [`docs/agent-tools.md`](agent-tools.md) maps each skill to its agents.

## §8. Delegation & the approval flow

The highest-stakes path, kept on a Cloudflare Workflow for durability ([ADR 0003](adr/0003-approval-gate-on-cloudflare-workflows.md)). `WorkerJobWorkflow.run` ([`src/jobs/worker-job.ts`](../apps/agents/src/jobs/worker-job.ts)) runs one round per proposal:

1. The Correspondent calls **`delegateToWorker`**, which creates the `ticket` already linked to its Workflow id and starts the run (the ticket is deleted if the start fails).
2. **generate**: the model call and the template's skills run with the deliverable folder set to `agent`, so nothing reaches the customer yet.
3. **propose**: the template's **Action type** builds the proposed payload and its **Policy** is resolved (the template's `default_policies` entry, else the type's default; an invalid value fails closed to `require_approval`). Every policy creates an `action`.
4. **wait / decide** (only `require_approval`, [ADR 0006](adr/0006-approval-gates-only-high-impact-actions.md)): the ticket goes to `awaiting_approval` and the run pauses on `step.waitForEvent("decision-<actionId>")` for up to 60 days. An Operator decides on `/approvals`; `POST /api/backoffice/actions/:id/decide` and the Workflow share `submitDecision`. Request-changes starts the next round with the feedback, at most `MAX_REVISIONS` (3) times; reject ends the ticket and nothing reaches the customer folder.
5. **execute**: the Action type's executor promotes the deliverable's assets to the customer folder (or presents the approved `publish_post` draft), the action is marked `executed` and the ticket `done`, and the Workflow signals the result to the Correspondent, which presents it in chat (markdown, so images render inline).

Action types live one module each under `apps/agents/src/action/` (`worker-deliverable.ts`: default `auto_execute`; `publish-post.ts`: default `require_approval`). The Workflow body never branches on type. Retried steps do not duplicate effects: Action ids are deterministic per round, and decision and execution writes only apply from `pending` and `approved`.

A weekly **proactive sweep** (`scheduled()` cron) gates each active company on brief completeness and a weekly window, then signals a "suggest next work" prompt to its Correspondent.

## §9. Library and Memory

- **Library** (`library/assets.ts`) owns an asset end to end: it stores the R2 object and then the row (deleting the object if the row fails), promotes agent material to the customer folder with one row update, deletes objects before rows, and serves bytes after `readerScope` authorizes the reader ([ADR 0007](adr/0007-asset-library-folders-vs-memory.md)). Persisted content references an asset as `/assets/<id>`, which never expires; the Worker serves it behind `requireMember` (a Customer reads their Company's customer folder; an Operator reads any Company).
- **Memory** (`memory/memory.ts`) owns two stores: `remember` writes the `memory_fact` rows and their vectors (deleting the rows if the index write fails), and `recall` queries the index and reads the matching rows back, scoped to the Company.

## §10. Channels

The customer reaches the Correspondent over the **web chat only**: the Flue agent route (`POST`/`GET /agents/correspondent/:companyId`, HTTP+SSE). There are no external messaging connectors. Flue's `channels/` convention is reserved for future inter-agent transport; nothing uses it today.

## §11. Authentication & authorization

- **Better Auth** runs in the Worker at `/api/auth/*` (Postgres-backed, emails through `@repo/transactional` + Resend) and issues a host-only cookie on the app that proxied the call; magic link and email/password.
- **Identity** (`identity/identity.ts`) resolves a request to signed-in `{userId, companyId, role}`, signed out (401), unavailable (503), or no membership on the surface (403). `OWNER`/`STAFF` belong to the operator surface and `CUSTOMER` to the customer surface (`SURFACE_OF_ROLE` in `@repo/worker-api/contracts`). A request acts through the caller's membership on the surface it calls; no client names an org ([ADR 0011](adr/0011-worker-hosts-better-auth.md)).
- **Gates** (`identity/gates.ts`): `requireCustomer` on `/api/me/*`; `requireCustomerOfPathTenant` on `/agents/*` and `/api/teams/*` (the path's company must be the session's); `requireOperator` on `/api/backoffice/*` (cross-tenant, [ADR 0005](adr/0005-operator-is-platform-staff-cross-tenant.md)); `requireMember` on `/assets/:id` (either surface, the Operator membership first). Operators never open a connection to an agent; they act through REST.
- **Next apps** hold no auth secret and no database URL. `proxy.ts` only checks for the session cookie and forwards the client IP on `/api/auth/*`; server components read `/api/me` from the Worker, where 401 sends the visitor to `/login` and any other failure renders the error boundary.
- **Rate limits**: Better Auth keeps them in Postgres, keyed on the browser's address, which the Next proxy forwards as `x-qolmeia-client-ip` with `TRUSTED_PROXY_SECRET`; without the secret the Worker uses `cf-connecting-ip` ([`docs/deploy.md`](deploy.md) §3).

## §12. The canonical end-to-end flow

1. **Sign-up / magic-link**: Better Auth on the Worker, reached through the app's `/api/auth/*` rewrite, issues a host-only cookie on that app.
2. **Client opens**: `requireCustomer` → `/api/me`, answered by the Worker's identity module.
3. **`status === "onboarding"`**: customer chats the **Planner**; it calls `extractBrief` + `proposeTeam`, then surfaces "Confirmar Time".
4. **Customer confirms**: `POST /api/teams/:companyId/confirm` materialises `team` + `team_member`, flips `company.status = active`, and seeds Correspondent memory (`remember`), all in one transaction.
5. **`status === "active"`**: customer chats the **Correspondent**, which `delegateToWorker`s.
6. The **delegation + approval flow** of §8 runs; the deliverable lands back in chat.

## §13. Tooling, conventions & local dev

- **Linter** oxlint · **Formatter** oxfmt (sorts imports) · **Dead code** fallow · **Tests** Vitest (`apps/agents` runs on `@cloudflare/vitest-pool-workers` against Miniflare, with Postgres through the local Hyperdrive binding) · **Pre-commit** Husky + lint-staged.
- **Agents bundler** Vite with `@flue/vite` + `@cloudflare/vite-plugin`.
- **Imports** `#/*` → `src/*` (Node subpath imports) in `apps/agents`; `@/*` → `src/*` in the Next apps.
- **Client chat** uses `@flue/react` (`useFlueAgent` over the SDK client: durable history snapshot, live SSE, reconnection from checkpoints, optimistic reconcile); the SSR-safe `Chat` shell gates the hook behind a client-only flag and shows a skeleton until `historyReady`. The Planner's greeting and first question render client-side without a synthetic submission. Live roster updates stream from the `TeamEvents` Durable Object at `/api/me/team/events`, with a 30-second polling fallback.
- **Local dev:** [`docs/LOCAL_DEV.md`](LOCAL_DEV.md). **Deploy:** [`docs/deploy.md`](deploy.md).

See also: [ADRs](adr) · [`AGENTS.md`](../AGENTS.md) (agent-facing build guide) · [`CONTEXT.md`](../CONTEXT.md) (domain glossary) · [`PRODUCT.md`](../PRODUCT.md).
