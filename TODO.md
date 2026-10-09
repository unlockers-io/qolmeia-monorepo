# TODO

Open work items, ordered by impact. Each top-level entry is a PR-sized slice. The product roadmap (connectors, new skills, the Cobrança vertical) lives in [`docs/agent-tools.md`](docs/agent-tools.md).

## 1. Decide what re-confirming an active Team does (open product decision)

`POST /api/teams/:companyId/confirm` on a Company whose Team is already active runs the whole confirm again (`team/confirm.ts`): it overwrites the Correspondent's `can_delegate_to` with the confirmed template set, which drops any Worker hired later, and it seeds the brief facts into Memory a second time. Decide whether a second confirm is refused, merges with the current roster, or replaces it on purpose, then make the route do that and test it.

## 2. Customer provisioning

No route grants a `CUSTOMER` membership: the dev seed and SQL are the only way to attach an Account to a Company. `POST /api/backoffice/companies` also makes the creating Operator an `OWNER` member of the new Company, while ADR 0005 says Operators belong to no customer Company. Design the operator flow that creates a Company and invites its first Customer, and stop writing the Operator's membership.

## 3. Onboarding end to end

No automated test runs the onboarding path: a Planner turn with a stubbed model, `extractBrief` and `proposeTeam`, the confirm, then a Correspondent turn that recalls a brief fact. The Playwright suite covers the auth flows only. Add it as a Worker test with the model stubbed at `globalThis.fetch`, the way `worker-job.test.ts` does.

## 4. Operator directory and assigned coverage

Coverage is self-service: each Operator picks their own Companies and disciplines. Assigning coverage to someone else needs a directory of `OWNER`/`STAFF` users first (ADR 0005).

## 5. The `notify-only` feed

`notify-only` executes and records an `ACTION_NOTIFY` activity entry, but no Operator surface lists those entries apart from the general activity log (ADR 0006). No shipped template uses the tier yet.

## 6. Production hardening

- Hyperdrive connects as the Postgres superuser. Create a least-privilege role for the Worker and update the config (ADR 0010).
- Hyperdrive cannot verify Railway's certificate (`sslmode=require`). Revisit when Railway serves a verifiable one.
- The Worker has no CD. Deploy it from CI on merge to `main`, with the commit in the deploy message.

## 7. Smaller items

- Activity-log payload renderers: the backoffice prints every payload as JSON. Mirror the `action-renderers` registry with an optional renderer per activity `type`.
- A staged `--latest` dependency update (including Next 16.4), on its own and not bundled with a deploy.
