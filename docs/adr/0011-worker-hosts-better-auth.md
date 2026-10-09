# The Worker hosts Better Auth and decides who the caller is

After [ADR 0010](./0010-worker-reaches-postgres-through-hyperdrive.md) the agents Worker owned all product data, and `apps/api` (Hono on Node, Railway) was left with Better Auth and `/api/me`. Four places still decided who a caller was, and they disagreed:

- the Next `proxy.ts` ran its own Better Auth instance against Postgres;
- the Next server helpers fetched the Worker's `/api/me` and picked the oldest allowed membership;
- the Worker relayed to `apps/api` behind a 60-second KV cache, answered 400 `org_required` for a multi-org account and 502 on an outage;
- `apps/api` returned a null org when ambiguous and 503 on an outage.

Role lists were written out in about eight places. A cold backoffice render made about 16 calls between services and about 22 identity queries. The Vercel projects held `DATABASE_URL` and `BETTER_AUTH_SECRET` only to validate a cookie.

**Decision:** Better Auth stays the auth library everywhere: same configuration, tables, cookie names, magic links and client SDK. Only its server moves, into the Worker, mounted at `/api/auth/*` with the Worker's per-request Prisma client. The Worker has one identity module. It resolves a request to signed-in `{userId, companyId, role}`, signed out, unavailable, or no membership on the surface. Every gate uses it, and `GET /api/me` is answered in-process.

- **One role vocabulary.** The Prisma `OrgRole` enum, with each role assigned to a surface once (`SURFACE_OF_ROLE` in `@repo/worker-api/contracts`): `CUSTOMER` is the customer surface, `OWNER` and `STAFF` the operator surface.
- **One multi-org rule.** A request acts through the caller's membership on the surface it calls. A Customer belongs to one Company and an Operator to the one Qolmeia org (ADR 0005), so there is one candidate. For data that breaks that invariant, the oldest membership wins. No client names an org: `X-Org-Id` and `?org_id=` are gone.
- **Gates.** Customer REST and agent paths are `CUSTOMER`-only, and a company id in the path must be the session's (ADR 0001). Operator REST is role-based and cross-tenant, taking the target company from the URL (ADR 0005).
- **Next apps.** `proxy.ts` only checks for the session cookie. Server components read `/api/me` from the Worker: 401 sends the visitor to `/login`, and any other failure renders the error boundary. `/api/auth/*` rewrites to the Worker like the other Worker routes, so cookies stay host-only on each app.
- **Rate limits.** Better Auth stores them in Postgres, keyed on the browser's address. Behind the Vercel rewrite Cloudflare only sees Vercel's egress IP, so each Next `proxy.ts` forwards the address Vercel wrote into `x-forwarded-for` as `x-qolmeia-client-ip`, with `TRUSTED_PROXY_SECRET`. The Worker trusts that header only when the secret matches. Otherwise it uses `cf-connecting-ip`, which Cloudflare sets.

## Consequences

- Railway hosts only Postgres. `apps/api`, its KV session cache, `AUTH_SERVICE_URL`, `CLIENT_ORIGINS` and the Worker's CORS middleware are deleted.
- Vercel holds no database credentials and no auth secret. Its only auth-related secret is `TRUSTED_PROXY_SECRET`.
- The Worker needs Workers Paid. Better Auth and React Email add about 750 KiB gzip, which takes the upload past the Free plan's 3 MiB, and password hashing needs more CPU than Free allows. On workerd `@better-auth/utils` resolves to `node:crypto` scrypt, so existing password hashes still verify.
- `useSecureCookies` still derives from `WEB_APP_URL`, now a Worker var, so existing sessions keep their `__Secure-qolmeia.*` cookies across the move.
- E2E auth runs against the real Worker (`vite dev` on the job's Postgres) instead of `apps/api` and a stub.
