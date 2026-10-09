# Qolmeia

Monorepo for Qolmeia, an agent platform where each customer Company gets a Team of AI agents and human Operators approve sensitive actions. The runtime is a Cloudflare Worker that hosts Better Auth, the Flue agents, the customer and operator REST APIs, R2 assets, and the approval Workflows, plus three Next.js apps on Vercel. Auth and product data share Postgres (on Railway) through Prisma and Hyperdrive.

The complete shipped-feature inventory lives in [`docs/FEATURES.md`](docs/FEATURES.md), with screenshots
and product flows in [`docs/PRODUCT_MAP.md`](docs/PRODUCT_MAP.md). Architecture details live in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), and local setup is in
[`docs/LOCAL_DEV.md`](docs/LOCAL_DEV.md).

## Apps

| App               | Package       | Framework         | Dev URL                                | Purpose                                           |
| ----------------- | ------------- | ----------------- | -------------------------------------- | ------------------------------------------------- |
| `apps/agents`     | `worker-bees` | Cloudflare Worker | `https://qolmeia.agents.localhost`     | Better Auth, Flue agents, product APIs, Workflows |
| `apps/web`        | `web`         | Next.js 16        | `https://qolmeia.web.localhost`        | Customer onboarding and chat                      |
| `apps/backoffice` | `backoffice`  | Next.js 16        | `https://qolmeia.backoffice.localhost` | Operator approvals and team management            |
| `apps/landing`    | `landing`     | Next.js 16        | `https://qolmeia.landing.localhost`    | Public marketing site                             |

## Packages

| Package                   | Purpose                                            |
| ------------------------- | -------------------------------------------------- |
| `@repo/auth`              | Better Auth factory and the session-cookie helpers |
| `@repo/db`                | Prisma clients and the shared Postgres schema      |
| `@repo/worker-api`        | Typed Worker client and its contracts              |
| `@repo/app-shell`         | Next config, proxy, and session helpers            |
| `@repo/transactional`     | React Email templates and Resend sender            |
| `@repo/ui`                | Shared shadcn-style UI package and Tailwind preset |
| `@repo/social-image`      | Open Graph image text rendering                    |
| `@repo/observability`     | Structured logging                                 |
| `@repo/portless-env`      | Dev URLs from portless                             |
| `@repo/config-vitest`     | Shared Vitest config                               |
| `@repo/typescript-config` | Shared TypeScript config                           |

## Prerequisites

- Node.js 24 or newer
- pnpm 11, matching `packageManager`
- Docker, for local Postgres on `:5436`
- Wrangler, installed through the workspace dependencies

## Quick Start

```bash
pnpm install
docker compose up -d

DATABASE_URL=postgresql://qolmeia:qolmeia123@localhost:5436/qolmeia \
  pnpm --filter=@repo/db db:push

pnpm --filter=worker-bees db:seed

pnpm dev
```

Each app has its own environment file. Copy from the committed examples:

```bash
cp apps/web/.env.example apps/web/.env
cp apps/backoffice/.env.example apps/backoffice/.env
cp apps/agents/.dev.vars.example apps/agents/.dev.vars
```

`apps/agents/.dev.vars` holds the Worker's secrets: `BETTER_AUTH_SECRET` and `OPENROUTER_API_KEY`, plus `DATABASE_URL` for the seed script. The Next apps hold no secrets in development. The Worker itself reaches the docker Postgres through the `HYPERDRIVE` binding's `localConnectionString`.

## Useful Commands

```bash
pnpm dev                  # run all apps through Turbo
pnpm dev --filter=worker-bees
pnpm dev --filter=web
pnpm dev --filter=backoffice

pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
```

## Local Accounts

`pnpm --filter=worker-bees db:seed` creates:

| Surface    | Role     | Email                  | Password                    |
| ---------- | -------- | ---------------------- | --------------------------- |
| Backoffice | OWNER    | `operator@qolmeia.dev` | `Qolmeia-Dev-OperatorPass!` |
| Client     | CUSTOMER | `customer@qolmeia.dev` | `Qolmeia-Dev-CustomerPass!` |

The client login also offers magic links. Without `RESEND_API_KEY`, the Worker logs every magic-link and password-reset URL; open it as-is.
