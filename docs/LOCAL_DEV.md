# Running Qolmeia Locally

This guide brings up the current stack: the Cloudflare Worker (agents and Better Auth), the customer client, and the operator backoffice. For architecture context, see [`docs/ARCHITECTURE.md`](ARCHITECTURE.md).

## 1. Prerequisites

| Tool    | Version                                                         | Check              |
| ------- | --------------------------------------------------------------- | ------------------ |
| Node.js | 24 or newer                                                     | `node --version`   |
| pnpm    | 11 (`packageManager` pins the exact version; Corepack picks it) | `pnpm --version`   |
| Docker  | any recent version                                              | `docker --version` |

## 2. Install and Start Postgres

```bash
pnpm install
docker compose up -d
```

Docker starts Postgres on host port `5436`. Postgres holds auth and product data; under `vite dev` R2 is a local Miniflare bucket and Memory uses the in-memory index (`MEMORY_BACKEND=in-memory`).

## 3. Environment Files

Copy the committed examples:

```bash
cp apps/web/.env.example apps/web/.env
cp apps/backoffice/.env.example apps/backoffice/.env
cp apps/agents/.dev.vars.example apps/agents/.dev.vars
```

Important local variables:

| File                    | Variables                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| `apps/agents/.dev.vars` | `BETTER_AUTH_SECRET`, `OPENROUTER_API_KEY`, `DATABASE_URL` (seed script), optional `RESEND_API_KEY` |
| `apps/web/.env`         | optional `AGENTS_INTERNAL_URL`                                                                      |
| `apps/backoffice/.env`  | optional `AGENTS_INTERNAL_URL`                                                                      |

The Next apps rewrite `/api/auth/*`, `/api/me/*`, `/api/teams/*`, `/api/backoffice/*`, `/agents/*`, and `/assets/:id` to the Worker so cookies stay first-party in development. They hold no database URL and no auth secret.

## 4. Initialize Data

Push the shared auth and product Prisma schema to Postgres:

```bash
DATABASE_URL=postgresql://qolmeia:qolmeia123@localhost:5436/qolmeia \
  pnpm --filter=@repo/db db:push
```

Seed the dev organization, the two logins, the default templates, and the agent team (idempotent; reads `DATABASE_URL` and `BETTER_AUTH_SECRET` from `apps/agents/.dev.vars`):

```bash
pnpm --filter=worker-bees db:seed
```

## 5. Run the Stack

Run everything:

```bash
pnpm dev
```

Or run one app per terminal:

```bash
pnpm dev --filter=worker-bees
pnpm dev --filter=web
pnpm dev --filter=backoffice
```

## 6. Dev URLs

| Surface    | URL                                    |
| ---------- | -------------------------------------- |
| Worker     | `https://qolmeia.agents.localhost`     |
| Client     | `https://qolmeia.web.localhost`        |
| Backoffice | `https://qolmeia.backoffice.localhost` |

Seeded accounts:

| Surface    | Role     | Email                  | Password                    |
| ---------- | -------- | ---------------------- | --------------------------- |
| Backoffice | OWNER    | `operator@qolmeia.dev` | `Qolmeia-Dev-OperatorPass!` |
| Client     | CUSTOMER | `customer@qolmeia.dev` | `Qolmeia-Dev-CustomerPass!` |

The client login also offers magic links. Without `RESEND_API_KEY` the Worker logs every magic-link and password-reset URL; open it as-is. The seed only sets a password when it creates the user, so an account first created through a magic link has none.

portless prefixes each URL with the checkout's branch name in a git worktree (e.g. `https://<branch>.qolmeia.web.localhost:1355`); `portless get qolmeia.web` prints it. Node clients need `NODE_EXTRA_CA_CERTS=~/.portless/ca.pem` to trust it.

## 7. Verify

```bash
pnpm typecheck
pnpm lint
pnpm test

curl http://127.0.0.1:8787/healthz
```

Useful targeted checks:

```bash
pnpm --filter=web typecheck
pnpm --filter=worker-bees typecheck
pnpm --filter=web test -- --run src/components/chat.test.tsx
pnpm --filter=worker-bees test -- --run src/__tests__/skill-tool-schema.test.ts
```

Worker tests run against Postgres through the local Hyperdrive binding, in a database named after the checkout path, so worktrees run the suite in parallel. Model calls are stubbed; no OpenRouter key is needed.

## 8. Common Pitfalls

| Symptom                                     | Fix                                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Client/backoffice cannot reach the Worker   | Check `AGENTS_INTERNAL_URL`, defaulting to `http://127.0.0.1:8787`                                           |
| Sign-in fails with a 500 from the Worker    | Set `BETTER_AUTH_SECRET` (32+ characters) in `apps/agents/.dev.vars`                                         |
| Worker has no local data                    | Check `HYPERDRIVE` in `wrangler.jsonc`, then rerun `pnpm --filter=worker-bees db:seed`                       |
| Real agent calls fail with 401              | Set a real `OPENROUTER_API_KEY` in `apps/agents/.dev.vars` ("User not found" means the key is a placeholder) |
| `vite` or `vitest` fails to load its config | Pass `--configLoader runner`                                                                                 |
