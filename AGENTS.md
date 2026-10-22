# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Friction Log

- Log papercuts and friction (tooling, docs, APIs, tests, conventions) as you hit them with `npx frog log`.
- Do not add global, system, or internal friction.
- Run `npx frog list` first to see what is already known.

Entries live in `.agents/friction-log/`, one directory each. A GitHub Action reports them as issues and deletes the entry once the issue closes, so anything still in that directory is still outstanding.

## Standards

This repo follows the fleet's shared standards, checked by `standy` (`~/dev/standy`).

- Before editing, run `standy standards --for <paths>` for the rules that apply to the files you will touch.
- Before finishing, run `standy check --changed --fix-hints` and fix what fails. It only sees tracked files, so run `git add -N` on new files first.
- When a failure is unclear, `standy explain <rule>` prints what the rule asserts, why, and how to fix it.

## Commands

```bash
# Development
pnpm dev                                 # turbo runs every app in parallel
pnpm dev --filter=worker-bees            # Cloudflare Worker + Better Auth (vite dev, https://qolmeia.agents.localhost)
pnpm dev --filter=web                 # customer app (Next.js, https://qolmeia.web.localhost)
pnpm dev --filter=backoffice             # operator panel (Next.js, https://qolmeia.backoffice.localhost)

# Build / Lint / Typecheck
pnpm build                        # all packages + apps (turbo cached)
pnpm lint                         # oxlint
pnpm typecheck                    # tsc --noEmit + wrangler types for agents
pnpm format                       # oxfmt (write)
pnpm format:check                 # oxfmt (check only, used in CI)

# Testing
pnpm test                         # vitest unit tests across all packages

# Database (Prisma/Postgres, reached by the Worker through Hyperdrive)
pnpm db:generate                  # generate Prisma client
pnpm db:push                      # push schema to Postgres
pnpm --filter=@repo/db db:seed    # seed the default templates (what prod runs)
pnpm --filter=worker-bees db:seed # dev seed: logins, dev org, templates, team
```

## Architecture

Monorepo managed by pnpm workspaces + Turborepo. Node 24, pnpm 11 (`packageManager` pins the exact version). One Cloudflare Worker is the backend; three Next apps on Vercel are its only browser-facing origins; Postgres on Railway is the system of record ([`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)).

### Apps

| Folder            | Package name  | Framework         | Dev URL                                           | Audience                                                                                                                                                                                 |
| ----------------- | ------------- | ----------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/agents`     | `worker-bees` | Cloudflare Worker | `https://qolmeia.agents.localhost` (vite dev)     | Hosts Better Auth (`/api/auth/*`) and owns product data. Customer chat (Flue HTTP+SSE), REST for operators (`/api/backoffice/*`) and customers (`/api/me`, `/api/me/*`, `/api/teams/*`). |
| `apps/web`        | `web`         | Next.js 16        | `https://qolmeia.web.localhost` (portless)        | End-customer chat surface (CUSTOMER role).                                                                                                                                               |
| `apps/backoffice` | `backoffice`  | Next.js 16        | `https://qolmeia.backoffice.localhost` (portless) | Operator panel (OWNER/STAFF roles).                                                                                                                                                      |
| `apps/landing`    | `landing`     | Next.js 16        | `https://qolmeia.landing.localhost` (portless)    | Public marketing site. No auth, no Worker calls.                                                                                                                                         |

The browser never talks to the Worker directly: each Next app rewrites `/api/auth/*` and the Worker's surface to itself (`/api/backoffice/*` on backoffice; `/api/me`, `/api/me/*`, `/api/teams/*`, and the `/agents/*` chat HTTP+SSE on client; `/assets/:id` on both) so the Better Auth cookie stays first-party: `.localhost` hosts are a public suffix, so no cookie can span `qolmeia.web.localhost` and `localhost:8787`. Server-side code and the rewrites reach the Worker via `AGENTS_INTERNAL_URL` (default `http://127.0.0.1:8787`). Prod works the same way: every session cookie is host-only on its app.

### Runtime

- **Per-tenant agents are Durable Objects**: `CorrespondentV2` and `PlannerV2` in `src/agents/` are `'use agent'`
  modules whose exported function names generate `FlueCorrespondentV2Agent` / `FluePlannerV2Agent` (one DO
  instance per company id). Renaming a function changes its storage identity unless pinned with `agentName`.
  Both are mounted explicitly in `app.ts` via `createAgentRouter`, behind the `requireCustomerOfPathTenant` gate.
- **Approvals run on Workflows**: every delegated Ticket runs a `WorkerJobWorkflow`: generate → propose an Action → (for `require_approval`) wait on `waitForEvent("decision-<actionId>")` until an Operator decides via `/api/backoffice/actions/:id/decide` → execute. Each Action type is one module under `action/` (proposed payload, executor, default policy); the Workflow body never branches on type (ADR 0006).
- **Better Auth and identity live in the Worker** (ADR 0011). `lib/auth.ts` mounts Better Auth at `/api/auth/*`; `identity/` resolves every request to signed-in `{userId, companyId, role}`, signed out, unavailable, or no membership on the surface, and its gates guard every route. A request acts through the caller's membership on the surface it calls (`activeMembership` in `@repo/worker-api/contracts`); no client names an org.
- **Postgres is the system of record for auth and product data.** The Worker reaches Postgres through the `HYPERDRIVE` binding and Prisma's `cloudflare` client, with a short-lived client inside each request, Workflow step, or skill call (`lib/db.ts`). Product data lives in domain modules (`team/`, `ticket/`, `action/`, `company/`, `library/`, `memory/`, `activity/`, `template/`, `operator/`). Each use case is one interactive transaction, with its activity entry written inside it (ADR 0010). Schema in `packages/db/prisma/schema.prisma`.
- **R2 holds binary assets** (`ASSETS` binding). The Library module (`library/assets.ts`) owns them: the `asset` row is the authority, and persisted content references an asset as `/assets/:id`, which the Worker serves behind the `requireMember` gate (a Customer reads their Company's customer folder; an Operator reads any Company).
- **Memory owns two stores** (`memory/memory.ts`): `remember` commits the `memory_fact` row before publishing its Vectorize vector; pending rows (`indexed_at IS NULL`) retry every minute. Team confirmation inserts facts in its transaction and leaves indexing to that scheduled handler. `recall` queries Vectorize and reads the rows back. `MEMORY_BACKEND=in-memory` swaps Vectorize for a per-isolate index in `vite dev` and tests; anywhere else a missing `AI` or `VECTORIZE` binding throws.

### Packages

| Package                   | Purpose                                                                                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@repo/auth`              | `createAuth` factory wrapping Better Auth (magic-link + email/password + organization invitations), hosted by the Worker; session-cookie and client-IP helpers. |
| `@repo/db`                | Prisma schema plus Node and Cloudflare Worker client entry points.                                                                                              |
| `@repo/transactional`     | React Email templates + Resend sender.                                                                                                                          |
| `@repo/ui`                | shadcn-style component library + Tailwind preset shared by the two Next apps.                                                                                   |
| `@repo/social-image`      | Open Graph image text rendering (fontkit + Geist) for the Next apps.                                                                                            |
| `@repo/config-vitest`     | Shared Vitest config.                                                                                                                                           |
| `@repo/typescript-config` | Shared tsconfig bases.                                                                                                                                          |
| `@repo/app-shell`         | Next glue shared by `web` and `backoffice`: `./next-config`, `./proxy`, `./session`, `./server-api`, `./auth-client`, `./signup`.                               |
| `@repo/worker-api`        | Typed client for the agents Worker plus its request/response contracts (`./contracts`, `./brief`).                                                              |
| `@repo/observability`     | Structured logging. Exports `./client`, `./fields`, `./next`, `./next/instrumentation`, `./hono`.                                                               |
| `@repo/portless-env`      | App registry (`./apps`: portless names, loopback ports, URL env defaults) + `applyPortlessUrls`, which fills dev URL env vars from `portless get`.              |

### The canonical E2E flow

1. **Invitation and sign-in**: an Operator invites the Customer's e-mail from the backoffice (`POST /api/backoffice/companies/:companyId/invitations`); the e-mailed link opens `/convite/<id>` on the web app, which signs the visitor in (magic link or password) and accepts through Better Auth's organization plugin, creating the `CUSTOMER` membership. Better Auth on the Worker, reached through the app's `/api/auth/*` rewrite, issues a host-only cookie on that app.
2. **Client opens**: `requireCustomer` → `GET /api/me` on `apps/agents`, answered in-process by the identity module.
3. **status === "onboarding"**: chat against `/agents/planner/<companyId>`. Planner calls `extractBrief` and `proposeTeam`, then surfaces a "Confirmar Time" button.
4. **Customer confirms**: `POST /api/teams/:companyId/confirm` materialises `team` + `team_member`, flips `company.status = 'active'`, and seeds Correspondent memory.
5. **status === "active"**: chat against `/agents/correspondent/<companyId>`. Correspondent uses `delegateToWorker` to spawn child tickets, each of which instantiates a `WorkerJobWorkflow` (the deliverable is generated with `generateText`, not a Flue agent).
6. **Workflow generates and proposes**: the specialist's skills write into the agent folder; the template's Action type builds the proposed payload, and its Policy decides. `auto_execute` and `notify_only` go straight to step 8; `require_approval` sets the Ticket to `awaiting_approval` and waits on `waitForEvent("decision-<actionId>")`.
7. **Operator on `apps/backoffice`**: `requireOperator` → `/approvals` lists pending oldest-first → `/approvals/:id` shows the decide form → POST `/api/backoffice/actions/:id/decide` resumes the Workflow. Request-changes loops back to step 6 with the feedback, at most `MAX_REVISIONS` times; reject ends the Ticket.
8. **Workflow executes**: the Action type's executor runs (e.g. promotes the deliverable's assets from the agent folder to the customer folder) → marks the Action `executed` and the Ticket `done` → dispatches a `worker.deliverable_ready` **signal** to Correspondent, which renders the result in chat (markdown, so images appear inline). Internal dispatches must be signals: Flue marks them `display: "diagnostic"` so the prompt itself stays out of the customer's transcript, and the client filters on that field.

## Tooling

- **Linter**: oxlint (NOT ESLint). Config in `oxlint.config.ts`.
- **Formatter**: oxfmt (NOT Prettier). Config in `.oxfmtrc.json`. Sorts imports.
- **Pre-commit**: Husky + lint-staged runs `oxlint` + `oxfmt`.
- **Testing**: Vitest. `apps/agents` uses `@cloudflare/vitest-plugin` against Miniflare; its tests reach Postgres through the local Hyperdrive binding, in a database named after the checkout path, so worktrees run the suite in parallel.
- **Dead code**: `pnpm fallow:dead` (fallow) runs in CI's lint job; fix every unused export it reports.
- **Bundler (agents)**: Vite, via `@flue/vite` + `@cloudflare/vite-plugin`. The
  Worker entry is the virtual module `virtual:flue/worker`; `flueWorkerConfig()` merges the per-agent
  Durable Object bindings into the Cloudflare plugin's config, and `vite build` writes the merged
  `dist/worker_bees/wrangler.json` (with a `.wrangler/deploy/config.json` redirect that `wrangler deploy`
  follows). `wrangler.jsonc` has no `main`. Workers Builds deploys it on every merge to `main`; `pnpm run deploy` (`vite build && wrangler deploy`) deploys by hand ([`docs/deploy.md`](docs/deploy.md)).

## Environment

Each app has its own `.env.example`:

- **apps/agents**: `.dev.vars` (not `.env`). Holds `BETTER_AUTH_SECRET` and `OPENROUTER_API_KEY`, optional `RESEND_API_KEY`, plus `DATABASE_URL` for the Node scripts in `scripts/` (seed, memory reindex). `wrangler.jsonc` defines the rest in its `vars` block (`AI_GATEWAY_ACCOUNT_ID`, `AI_GATEWAY_NAME`, `WORKER_PUBLIC_URL`, `TRUSTED_ORIGINS`, `WEB_APP_URL`, `MEMORY_BACKEND`) and the `HYPERDRIVE` binding, whose `localConnectionString` points `vite dev` at the docker Postgres. Prod also sets the `TRUSTED_PROXY_SECRET` secret. Better Auth reads `envAuthConfig()` from `process.env`, which `nodejs_compat` fills from those vars and secrets. `CORS_ORIGINS` is unset there, so it defaults to the web and backoffice portless URLs, and `vite dev` sets it from portless in a worktree.
- **apps/web**: no database URL and no auth secret. `next.config.ts` (`createNextConfig` from `@repo/app-shell`) rewrites `/api/auth/*`, `/api/me`, `/api/me/*`, `/api/teams/*`, `/agents/*` and `/assets/:id` to `AGENTS_INTERNAL_URL` (default `http://127.0.0.1:8787`). `next build` bakes it into the rewrites, so prod sets it on the Vercel project, together with `TRUSTED_PROXY_SECRET`.
- **apps/backoffice**: same as client (its Worker rewrites cover `/api/auth/*`, `/api/backoffice/*` and `/assets/:id`).

`.env` files are git-ignored; `.env.example` is committed.

## Local development

Bring the stack up (assumes envs are copied from each `.env.example`):

```bash
# 1. Postgres on :5436
docker compose up -d

# 2. Push the shared Prisma schema
DATABASE_URL=postgresql://qolmeia:qolmeia123@localhost:5436/qolmeia \
  pnpm --filter=@repo/db db:push

# 3. Seed Postgres: creates the two logins, the dev org, templates, and team (idempotent).
#    Reads DATABASE_URL and BETTER_AUTH_SECRET from apps/agents/.dev.vars.
pnpm --filter=worker-bees db:seed

# 4. Run every app (or one per terminal with --filter)
pnpm dev
```

**Seeded dev credentials** (created by `apps/agents/scripts/seed-dev.ts`):

| Surface                                            | Role     | Email                  | Password                    |
| -------------------------------------------------- | -------- | ---------------------- | --------------------------- |
| Backoffice: `https://qolmeia.backoffice.localhost` | OWNER    | `operator@qolmeia.dev` | `Qolmeia-Dev-OperatorPass!` |
| Client: `https://qolmeia.web.localhost`            | CUSTOMER | `customer@qolmeia.dev` | `Qolmeia-Dev-CustomerPass!` |

The dev org is pinned to `cmpg10ke30000147uj4gpeadb` (slug `qolmeia-dev`). Both logins accept the passwords above; the client login defaults to e-mail and password and also offers a magic link. The seed only sets a password when it creates the user, so an account first created through a magic link has none. Without `RESEND_API_KEY`, the Worker logs every magic-link and password-reset URL; open it as-is and it signs you in on the app that requested it.

`packages/portless-env/src/apps.ts` is the app registry: each app's portless name and loopback port, the URL env vars each app fills, and the canonical `https://<name>.localhost` defaults derived from the names. Add or rename an app there. `@repo/auth/env-config` reads its host patterns, loopback origins, and `CORS_ORIGINS` default from the browser-safe `@repo/portless-env/apps`. App configs call `applyPortlessUrls(["WEB_APP_URL", …])` in `createNextConfig`, `apps/landing/next.config.ts`, and `apps/agents/vite.config.ts`; it runs `portless get` once per app and fills each env var only when it is unset or still holds the canonical default. It is a no-op unless `PORTLESS_URL` is set, so CI and production keep their real values. Import it by bare specifier (`@repo/portless-env`): a relative path resolves from the process cwd and breaks `next start apps/web` from the repo root.

## Conventions

- Path aliases: `@/*` → `src/*` in every app + package.
- pt-BR is the user-facing locale across agents, backoffice, and client.
- Activity-log `type` strings are stable and free-form; the backoffice categorises by prefix (`ACTION_*`, `TICKET_*`, `WORKER_*`, `TEAM_*`, `MEMBER_*`, `CUSTOMER_*`).
- Operator REST is `/api/backoffice/*` (`routes/backoffice.ts`, OWNER/STAFF only). Customer REST is `/api/me/*` and `/api/teams/*` (`routes/me.ts`, `routes/me-assets.ts`, `routes/teams.ts`).
- Agent paths at `/agents/<name>/<companyId>`, `/api/me/*` and `/api/teams/*` are gated to the CUSTOMER role; a company id in the path must be the session's. Operators don't open a connection to a DO; they call REST.
- Turbo caches: be conscious that `apps/agents` reads `wrangler.jsonc` vars at build time.

## Forms

- `@tanstack/react-form` with the form's Zod schema from the app's `src/lib/form-schemas.ts`. Forms that hold their values in `useState` (`useTemplateForm`, `DecisionForm`, `CoverageForm`, the company brief, the chat composer) follow the same rules by hand.
- The schema is the only validation: no HTML `required`, `minLength` or `maxLength`. Keep `noValidate` on a form with `type="email"` inputs. A character limit shows a live counter and fails on submit instead of truncating what was typed or pasted.
- Validation follows six rules:
  1. Validate on submit, then on every change: `validationLogic: revalidateLogic()` with `validators: { onDynamic: schema }`. No error shows before the first submit attempt, and after a failed one an error clears on the keystroke that fixes it. Never validate on blur. Put every rule in the one form-level schema, cross-field checks such as `password === confirmPassword` included: TanStack runs form-level validators only after field-level ones pass. A `useState` form sets a `submitAttempted` flag on submit and derives its errors from the current values on every render once the flag is set.
  2. Show a field's error whenever `!field.state.meta.isValid`. Don't add an `isTouched`, `isBlurred` or `submissionAttempts` check: rule 1 already holds errors back until submit.
  3. On a failed submit, `onSubmitInvalid` calls `focusFirstInvalidField(formApi.formId)` from `@repo/ui/lib/focus-first-invalid-field`, and the `ClientReadyForm` renders with `id={form.formId}` (React's `useId`, so server and client agree). A `useState` form takes `const formId = useId()`, renders `id={formId}` and calls the same helper. The helper focuses the form's first `[aria-invalid="true"]` control a frame later, because a submit handler runs before React renders the invalid state, so every control that can be invalid sets `aria-invalid`, radios included. Never call `.focus()` synchronously, and call `form.handleSubmit()` outside `startTransition`; start the transition inside `onSubmit`.
  4. Explain any rule people can't guess (password length, name length, allowed values, character limits) with a pt-BR `FieldDescription` or counter under the field from the start, linked through `aria-describedby` next to the error id. Live hints derived from the value are not validation errors.
  5. Server-only failures (wrong password, e-mail taken, rate limits) arrive on submit. Attach each one to its field, or render it in `FormAlert` from `@repo/ui/compositions/form-alert` at the top of the form, set when the submit fails and cleared on the next change: the form's `listeners: { onChange }` in TanStack, every change handler in a `useState` form, `mutation.reset()` when the message comes from a React Query mutation. Never report a submit failure in a toast: a toast disappears on its own, sits apart from the form and doesn't clear on change. Toasts are for successes and for actions outside a form, such as signing out or retiring a template. Keep auth failures generic.
  6. Keep the submit button enabled, and disable it only while submitting (`form.Subscribe` on `state.isSubmitting`, or the form's pending flag). Never disable it on `!canSubmit` or `!isValid`: a disabled button can't say which field is wrong. The one exception is a form with exactly one editable field, which may also disable submit while that field's trimmed value is empty or unchanged; use it only where empty is the obvious error, such as the chat composer. A form with more than one editable field never disables submit while unchanged: an unchanged submit sends nothing and says so in `FormAlert`. A client-side throttle never disables submit either: a submit inside the window is refused with a `FormAlert` that says when to retry.

## Design-system linting

Run `pnpm lint` after changes and fix every error. `oxlint.config.ts` registers `@shadcn/lint` and enforces all six rules as errors: component contracts, known Tailwind classes, static component class names, semantic colors, theme or scale values, and class-based styling. Use CSS custom properties for runtime geometry and named theme tokens for custom values. Use component variants for appearance and layout classes at call sites. All six rules also apply inside primitive directories. Shared styles belong to component variants or the owning stylesheet. Keep theme discovery local to each app. Exact class-merging fixture allowances apply only to the named test files.

## Upstream UI components

Keep registry primitives in `packages/ui/src/components` aligned with their configured shadcn Base UI style. Product adapters belong in `packages/ui/src/compositions`. Import variant factories beside the component, use local input IDs, normalize arbitrary validators through `FormFieldError`, and preserve semantic headings at call sites. Keep product branding in the theme, load `shadcn/tailwind.css`, and run `pnpm check:shadcn` with lint, typechecks, tests and the build. See `packages/ui/SHADCN.md` before updating the reviewed source lock.
