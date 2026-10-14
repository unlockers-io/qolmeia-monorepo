# The Worker reaches Postgres through Hyperdrive and owns product data

Product data moved from D1 to Postgres (see the superseded [ADR 0002](./0002-d1-system-of-record.md)), but the agents Worker could not open a Postgres connection: workerd validates TLS against public CAs, and Railway's Postgres presents a self-signed certificate. The workaround made `apps/api` the Worker's database. Every read and write was an HTTP call to `/api/internal/agents/<op>`, authenticated with `INTERNAL_SHARED_SECRET`, dispatched through switch statements to Prisma functions. That seam covered 56 operations and about 1.3k lines that existed only to cross it. It also cost three things:

- **A remote ORM.** Types and validation were declared three times (Worker forwarder, client contract, API zod schema). Outputs were cast, never validated. Dates crossed as epoch milliseconds and were converted again on the Worker. Domain logic was split across the seam: delegation authorized on the Worker over four RPC reads, and team errors travelled as a hand-synced string vocabulary.
- **No atomic use cases.** A use case could not hold a transaction across calls. Team confirm seeded memory after its transaction and swallowed failures. Delegation was three calls with no compensation. Brief updates were an unguarded read-merge-write. Activity writes ran outside the change they recorded, or swallowed their own errors inside a transaction, which made Postgres roll the whole transaction back while the call reported success.
- **A test shim.** Worker tests seeded with SQLite SQL, translated by regex into Postgres, and posted it to a raw-SQL endpoint on a real `apps/api` spawned on fixed ports. Two checkouts could not run the suite at once.

**Decision:** the Worker reaches Postgres directly through a Cloudflare Hyperdrive binding (`HYPERDRIVE`) and Prisma's `cloudflare` runtime client over `@prisma/adapter-pg`. It opens a short-lived client inside each request, Workflow step, or skill call and disconnects when that work ends, because workerd does not let one request use a socket another request opened. Product data lives in domain modules inside `apps/agents` (`team/`, `ticket/`, `action/`, `company/`, `library/`, `memory/`, `activity/`, `template/`, `operator/`). Routes, skills, and jobs call them in-process. Each use case is one Prisma interactive transaction, and activity entries are written inside it so a failed entry fails the use case. The `/api/internal/agents` surface, `@repo/worker-api/internal`, `@repo/internal-auth`, and `INTERNAL_SHARED_SECRET` are deleted. `apps/api` keeps only Better Auth and `/api/me`.

## The certificate

Hyperdrive connects to the origin from Cloudflare's network, so the Worker never performs the TLS handshake with Railway. The Worker talks to Hyperdrive. Hyperdrive talks to Railway with `sslmode=require`, which encrypts the connection but does not verify the certificate. Verification is not possible today: Railway's leaf certificate has `SAN=localhost` and is regenerated on restart near expiry and after a restore. That makes `verify-full` impossible and `verify-ca` break on every regeneration.

## Consequences

- Local dev and tests use Hyperdrive's `localConnectionString` against the docker Postgres, with no proxy service in between. Tests push the schema to a database named after the checkout path and seed through Prisma, so worktrees run the suite in parallel.
- Vite 8 resolves `require()` inside the test runtime to a package's ESM build, which breaks `pg` (workers-sdk#12984). `vitest.config.ts` pre-bundles `pg` with Node built-ins externalized until the pool fixes it.
- Prisma's query compiler ships in the Worker bundle. The Worker client uses the size-optimized build (`compilerBuild = "small"`), which takes the upload from 1.6 MiB to 2.4 MiB gzip, under the 3 MiB Workers Free limit.
- Open hardening items:
  - The Hyperdrive config embeds the Postgres superuser password. Rotating it requires `wrangler hyperdrive update`. A least-privilege role for the Worker is the follow-up.
  - Origin certificate verification waits on Railway serving a verifiable certificate.
