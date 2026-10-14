# TODO

Open work items, ordered by impact. Each top-level entry is a PR-sized slice. The product roadmap (connectors, new skills, the Cobrança vertical) lives in [`docs/agent-tools.md`](docs/agent-tools.md).

## 1. Onboarding end to end

No automated test runs the onboarding path: a Planner turn with a stubbed model, `extractBrief` and `proposeTeam`, the confirm, then a Correspondent turn that recalls a brief fact. The Playwright suite covers the auth flows only. Add it as a Worker test with the model stubbed at `globalThis.fetch`, the way `worker-job.test.ts` does.

## 2. Operator directory and assigned coverage

Coverage is self-service: each Operator picks their own Companies and disciplines. Assigning coverage to someone else needs a directory of `OWNER`/`STAFF` users first (ADR 0005).

## 3. The `notify-only` feed

`notify-only` executes and records an `ACTION_NOTIFY` activity entry, but no Operator surface lists those entries apart from the general activity log (ADR 0006). No shipped template uses the tier yet.

## 4. Smaller items

- Activity-log payload renderers: the backoffice prints every payload as JSON. Mirror the `action-renderers` registry with an optional renderer per activity `type`.
- A staged `--latest` dependency update (including Next 16.4), on its own and not bundled with a deploy.
