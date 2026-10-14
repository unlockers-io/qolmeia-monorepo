# Deploying Qolmeia to production

The single source of truth for taking Qolmeia live. Merging to `main` deploys the
three Next apps (Vercel); the Worker is deployed by hand (§4e). The dev `.localhost` / portless proxy is **dev-only**; prod
uses real subdomains, and each Next app proxies auth and the Worker through its
own origin, so every session cookie is host-only on its app.

## 1. The stack at a glance

| App               | Package       | Runtime                                                               | Host           | Prod subdomain       |
| ----------------- | ------------- | --------------------------------------------------------------------- | -------------- | -------------------- |
| `apps/agents`     | `worker-bees` | Cloudflare Worker (Better Auth, DO, Workflows, Prisma, R2, Vectorize) | **Cloudflare** | `agents.qolmeia.com` |
| `apps/web`        | `web`         | Next.js 16                                                            | **Vercel**     | `app.qolmeia.com`    |
| `apps/backoffice` | `backoffice`  | Next.js 16                                                            | **Vercel**     | `admin.qolmeia.com`  |
| `apps/landing`    | `landing`     | Next.js 16 (static marketing site)                                    | **Vercel**     | `www.qolmeia.com`    |

Postgres, on **Railway**, holds Better Auth and product data (company, ticket,
action, asset, team, memory_fact, …), accessed through Prisma from the Worker
over Hyperdrive. Railway hosts nothing else. Binary assets live in **R2** and
semantic agent memory in **Vectorize**.

## 2. External accounts you must create

| Service                               | For                                                                                                    | Secret / config name                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| **Cloudflare** (Workers Paid)         | the Worker: Better Auth, Durable Objects, Workflows, R2, Hyperdrive, Workers AI, Vectorize, AI Gateway | —                                          |
| **Railway** (or any managed Postgres) | Postgres                                                                                               | `DATABASE_URL`                             |
| **Vercel**                            | the three Next apps (web, backoffice, landing)                                                         | —                                          |
| **OpenRouter**                        | every LLM + image-gen call, routed through the CF AI Gateway                                           | `OPENROUTER_API_KEY`                       |
| **Resend**                            | transactional email (magic link, verification, password reset)                                         | `RESEND_API_KEY`                           |
| **Exa** (optional)                    | `webSearch` agent skill                                                                                | `EXA_API_KEY`                              |
| **Firecrawl** (optional)              | `fetchUrl` agent skill (or self-host keyless)                                                          | `FIRECRAWL_API_KEY` / `FIRECRAWL_BASE_URL` |
| **Domain / DNS**                      | `qolmeia.com` + the five subdomains                                                                    | —                                          |

See [`docs/agent-tools.md`](./agent-tools.md) for the full agent-integration
catalog (current tools and which agent uses each).

## 3. Domains + same-origin auth

Everything lives under **`qolmeia.com`**: `www.` (landing), `app.` (web),
`admin.` (backoffice), `agents.` (the Cloudflare Worker, which hosts Better
Auth). The browser only talks to the app it is on:

- Each Next app rewrites `/api/auth/*` and its Worker routes to
  `AGENTS_INTERNAL_URL` (`createNextConfig` in `@repo/app-shell`).
- Better Auth sets a host-only session cookie, so `app.` and `admin.` each hold
  their own session.
- `TRUSTED_ORIGINS` on the Worker lists the app origins, which Better Auth
  checks against the forwarded `Origin` header and builds emailed links on.

**Rate-limit identity.** Better Auth keeps its rate limits in Postgres, keyed on
the browser's address. Behind the Vercel rewrite Cloudflare sees Vercel's egress
IP in `cf-connecting-ip`, the same for every customer. So each Next app's
`proxy.ts` forwards the address Vercel wrote into `x-forwarded-for` (Vercel
overwrites that header, so a browser cannot choose it) as
`x-qolmeia-client-ip`, together with `TRUSTED_PROXY_SECRET`. The Worker trusts
that header only when the secret matches, and otherwise uses
`cf-connecting-ip`, which Cloudflare sets. A browser that calls
`agents.qolmeia.com` directly cannot present the secret, so it is limited on its
own address.

## 4. Cloudflare Worker: `apps/agents`

> All commands run from `apps/agents/`. First `wrangler login` (or set
> `CLOUDFLARE_API_TOKEN`).

### 4a. Provision resources

```bash
wrangler r2 bucket create qolmeia-assets
wrangler vectorize create qolmeia-memory-qwen3 --dimensions=1024 --metric=cosine
wrangler vectorize create-metadata-index qolmeia-memory-qwen3 --property-name=agentInstanceId --type=string
```

In the Cloudflare dashboard: create an **AI Gateway** named `qolmeia`, and note
your **account id** (`wrangler whoami`).

### 4b. Fill `wrangler.jsonc`

`wrangler.jsonc` already holds the production values. On a new account, replace
`AI_GATEWAY_ACCOUNT_ID`.

Every model request goes through `apps/agents/src/lib/models.ts`: the Flue
conversations (Correspondent and Planner), the Workflow's `generateText`, and
image generation. It sends each one to
`https://gateway.ai.cloudflare.com/v1/<AI_GATEWAY_ACCOUNT_ID>/<AI_GATEWAY_NAME>/openrouter/v1`
with `OPENROUTER_API_KEY` as the bearer token. The conversation and image model
ids live in that module; specialist models are set per template.

The prod `vars`:

- `WORKER_PUBLIC_URL=https://agents.qolmeia.com`
- `TRUSTED_ORIGINS=https://app.qolmeia.com,https://admin.qolmeia.com`
- `WEB_APP_URL=https://app.qolmeia.com`, the only input to Better Auth's
  `useSecureCookies` (`packages/auth/src/env-config.ts`). Unset, or not
  starting with `https://`, and the session cookies lose the `Secure` flag and
  the `__Secure-` prefix existing sessions carry.

The custom-domain route and the `ai` and `vectorize` bindings are part of the
production config; local Vite and Vitest runtimes drop the last two.

The Worker reaches Postgres through the `HYPERDRIVE` binding (ADR 0010). On a new
account, create the config against the Railway connection string and put its id
in `wrangler.jsonc`:

```bash
wrangler hyperdrive create qolmeia-postgres --connection-string="postgresql://...?sslmode=require" --caching-disabled
```

Rotating the Postgres password requires `wrangler hyperdrive update` with the
new connection string.

### 4c. Set secrets

```bash
wrangler secret put BETTER_AUTH_SECRET      # openssl rand -base64 48; changing it ends every session
wrangler secret put RESEND_API_KEY          # auth emails; unset, the Worker logs each link instead
wrangler secret put TRUSTED_PROXY_SECRET    # openssl rand -hex 32; MUST match both Vercel projects
wrangler secret put OPENROUTER_API_KEY
wrangler secret put EXA_API_KEY             # optional (webSearch skill)
wrangler secret put FIRECRAWL_API_KEY       # optional (fetchUrl skill)
```

### 4d. Initialize Postgres

For an existing deployment, follow [the model upgrade and memory cutover](./model-upgrade.md)
before deploying this Worker. Backfill the new Qwen3 index first; upgrade template
models only after the new Worker is live. The old memory index is retained.

Push the shared Prisma schema and seed the default templates before deploying the
Worker:

```bash
DATABASE_URL=postgresql://... pnpm --filter=@repo/db db:push
DATABASE_URL=postgresql://... pnpm --filter=@repo/db db:seed
```

### 4e. Deploy

```bash
pnpm run deploy   # vite build && wrangler deploy
```

Use `pnpm run deploy`: bare `pnpm deploy` is pnpm's own package-copy command.
Merges do not deploy the Worker, so run this after merging changes to
`apps/agents` or the packages it bundles, and compare
`wrangler deployments list` with `git log -- apps/agents` when in doubt.

The Durable Object + Workflow class migrations (`v1`–`v3` in `wrangler.jsonc`)
apply automatically on first deploy. If you didn't put the custom-domain route
in the config, map `agents.qolmeia.com` to the Worker in the dashboard
(Worker → Settings → Domains & Routes).

## 5. Railway: Postgres

Railway hosts only Postgres. Deploys never touch the schema: push schema changes
before deploying the Worker code that needs them (§4d). The Worker reaches the
database through Hyperdrive with `sslmode=require` (ADR 0010); nothing else
connects to it in production.

## 6. Vercel: `apps/web`, `apps/backoffice`, `apps/landing`

Three projects, each with **Root Directory** set to the app folder. The Git
integration deploys production on every push to `main` and a preview for every
pull request; previews lack the internal URLs below, so their login does not work. Leave the
build and install commands empty: Vercel's monorepo detection installs from the
repo root (pnpm workspaces) and runs `next build` in the root directory. Node
24.x, framework preset Next.js.

Existing projects live in the **`unlockers`** Vercel team as `qolmeia-web`,
`qolmeia-backoffice` and `qolmeia-landing`, mirroring the sibling monorepos
(`frow-web` / `frow-landing`).

`apps/landing` is a static marketing site: no auth, no Prisma, no session. It
needs only two vars:

| Var                       | Value                     |
| ------------------------- | ------------------------- |
| `NEXT_PUBLIC_WEB_APP_URL` | `https://app.qolmeia.com` |
| `NEXT_PUBLIC_LANDING_URL` | `https://www.qolmeia.com` |

`apps/web` and `apps/backoffice` run no Better Auth instance and hold no
database credentials. They proxy auth and the Worker through their own origin:

| Var                    | Value                                                         |
| ---------------------- | ------------------------------------------------------------- |
| `AGENTS_INTERNAL_URL`  | `https://agents.qolmeia.com`                                  |
| `TRUSTED_PROXY_SECRET` | the Worker's `TRUSTED_PROXY_SECRET` (§3, rate-limit identity) |
| `WEB_APP_URL`          | web: `https://app.qolmeia.com` (`metadataBase`)               |
| `BACKOFFICE_URL`       | backoffice: `https://admin.qolmeia.com` (`metadataBase`)      |

**`AGENTS_INTERNAL_URL` is read by `next build`**, not at runtime. Unset at build
time, the rewrites point at `127.0.0.1` and every sign-in 404s. Redeploy after
changing it.

Point `www.qolmeia.com` (and the `qolmeia.com` apex) at the landing project,
`app.qolmeia.com` at the web project, and `admin.qolmeia.com` at the backoffice
project in Vercel's domain settings. DNS for `qolmeia.com` is on Cloudflare;
each host needs a CNAME to the value Vercel shows under the project's Domains
tab, or an A record to `216.150.1.1` / `216.150.16.1`.

## 7. Order of operations

For an existing installation, merging deploys the Next apps; deploy the Worker
by hand. When a change moves a route between them, deploy the Worker first. Keep existing response fields compatible
throughout the rollout. Coverage
options retain string IDs in `disciplines`; the optional `disciplineNames` map
adds display labels without breaking older Workers or backoffice clients.

For the initial setup:

1. **Railway**: Postgres; gives you the connection string for the Hyperdrive
   config.
2. **Cloudflare** (Workers Paid): Hyperdrive, then the Worker on
   `agents.qolmeia.com` with its secrets (§4c).
3. **Vercel**: the two Next apps, pointed at the Worker.

`TRUSTED_PROXY_SECRET` must be **identical** on the Worker and both Next apps.

## 8. Smoke test after deploy

1. Sign in on `app.qolmeia.com` → session cookie set on `app.qolmeia.com`.
2. Client onboarding chat (Planner) → confirm a team.
3. Customer chat → Correspondent delegates → a Worker job runs.
4. A gated action lands on `admin.qolmeia.com` `/approvals` → decide it.
5. The approved deliverable appears in the customer chat and `/assets`.

## 9. Still open before "done"

- The Worker has no CD: deploy it by hand after merging (§4e).
- An **operator directory** (listing OWNER/STAFF users) doesn't exist yet, so
  the backoffice ships **self-service** coverage; an admin-assigns-others
  surface needs that directory first (ADR 0005 / 0008).
- A staged dependency update (`--latest`) was deferred; do it on its own, not
  bundled with a deploy.
