# Open decisions

Choices about this repo that nobody has made yet. Each entry says what the code does today, why changing it needs a decision, the options, and what to check first. A decision that gets made leaves this file: it becomes code, and an ADR in [`adr/`](./adr) when it shapes the architecture.

Every entry that touches `packages/db/prisma/schema.prisma` reaches production in the order [`deploy.md` §4d](./deploy.md#4d-initialize-postgres) describes. The queries below are read-only and run against the production Postgres on Railway.

## 1. Enum values and an activity category nothing writes

**Today.** No code writes these values, and each one still costs UI copy:

- `TicketStatus` `open`, `blocked` and `cancelled`. `ticket.status` defaults to `open`, and delegation always creates a Ticket as `in_progress` (`apps/agents/src/ticket/delegation.ts`). Labels in `apps/backoffice/src/lib/status.ts` and `apps/backoffice/src/app/(dashboard)/tickets/[id]/page.tsx`.
- `CompanyStatus` `paused`. Label in `apps/backoffice/src/app/(dashboard)/teams/page.tsx`.
- `AssetKind` `audio`. Label in `apps/web/src/components/assets-gallery.tsx`.
- The `TICKET` activity category (`packages/worker-api/src/contracts/activity.ts`): no activity type starts with `TICKET_`. It still has a filter chip in the backoffice and a dot in `apps/web/src/app/(client)/activity/page.tsx`.

**Why it is open.** Earlier versions wrote `TICKET_` entries and may have left Tickets as `open`. A Worker deployed with a smaller enum fails to read a row that holds a removed value, and the schema push fails on it too.

**Check first.**

```sql
SELECT status, count(*) FROM ticket GROUP BY 1;
SELECT status, count(*) FROM company GROUP BY 1;
SELECT kind, count(*) FROM asset GROUP BY 1;
SELECT count(*) FROM activity_log WHERE type LIKE 'TICKET\_%';
```

**Options.**

1. Every count for those values is zero: remove the values, their labels and the category in one PR, and change the Ticket default to `in_progress`. Deploy the Worker, then push the schema. **Recommended.**
2. Some rows hold them: rewrite those rows first to a value that stays (an old `open` Ticket becomes `done` or `rejected`, decided row by row), then option 1. Old `TICKET_` activity rows can stay if the category stays, or be left uncategorised.
3. Keep them as room for features (pausing a Company, cancelling a Ticket, audio assets). Then say so in `docs/ARCHITECTURE.md`, because today they read as supported.

**Once decided.** The status maps shrink to the states a Ticket can reach, and the audio branch of the asset gallery goes.

## 2. The `team` table

**Today.** `team` has one row per Company. `confirmed_at` repeats `company.status = 'active'`. Its remaining job is to be the row that hiring locks so two concurrent hires pick distinct display names (`lockTeam` in `apps/agents/src/team/members.ts`). Its id is derived from the Company id (`apps/agents/src/team/ids.ts`) and travels in `ConfirmTeamResponse.team.teamId` (`packages/worker-api/src/contracts/customer.ts`) and in the `TEAM_CONFIRMED` activity payload.

**Why it is open.** Dropping the table drops stored rows and removes `teamId` from a response the web app reads, and the two apps deploy separately.

**Options.**

1. Keep it. It costs one upsert in `apps/agents/src/team/confirm.ts` and one lock. **Recommended until a second Team per Company is ruled in or out.**
2. Drop it: lock the `company` row instead, refuse hiring while `company.status` is `onboarding`, and remove `teamId` from the contract. Deploy the web app that no longer reads `teamId` first, then the Worker, then drop the table.

**Once decided.** With option 2, `teamIdFor`, the `team` model and the reconfirm branch of `confirmTeam` are deleted.

## 3. The `skill` kill switch has no writer

**Today.** `skill` holds `id` and `enabled`. The Worker reads the disabled ids once per agent turn and once per generation step (`loadDisabledSkillIds` in `apps/agents/src/skills/registry.ts`). Nothing in the repo writes a row, and no screen shows the switch. A skill can only be turned off with SQL.

**Check first.** `SELECT id, enabled FROM skill;` and whether anyone has ever turned a skill off by hand.

**Options.**

1. Keep the table as an emergency switch operated with SQL, and write the statement into `docs/deploy.md`. **Recommended:** it is the only way to stop a misbehaving skill without a deploy.
2. Add an Operator toggle to the backoffice skill catalogue.
3. Drop the table and the two reads; turning a skill off then means removing it from the Templates or deploying.

## 4. Two brief fields with one possible value

**Today.** `companyBriefSchema` in `packages/worker-api/src/brief.ts` carries `schemaVersion` (always `BRIEF_SCHEMA_VERSION`) and `locale` (always `pt-BR`). Both are stored in `company.brief` and offered to the Planner as `extractBrief` input.

**Why it is open.** Removing them changes stored brief JSON and the tool schema the model sees. Keeping them is the hook for a second locale or a brief migration.

**Options.**

1. Keep both. **Recommended while a second locale is plausible** (ADR 0009 expects other verticals, not yet other languages).
2. Remove both from the schema and strip them from stored briefs on the next write. Nothing reads either field, so old rows need no backfill.

## 5. Two ways to create an agent instance

**Today.** Confirming a Team (`apps/agents/src/team/confirm.ts`) creates one Worker per chosen Template with an id derived from the Template and the Company (`worker-<templateId>-<companyId>`), the Template's display name, no name-collision check and no activity entry per Worker. Hiring (`hireMember` in `apps/agents/src/team/members.ts`) creates `wkr_<uuid>`, picks the next free display name and records `MEMBER_HIRED`. Because the confirm ids are derived, confirming twice creates nothing new.

**Why it is open.** Routing confirmation through hiring changes the ids stored for new Teams, adds `MEMBER_HIRED` entries the Customer sees in their activity feed, and needs a rule for a second confirmation.

**Options.**

1. Confirmation hires each chosen Template through `hireMember`, and a second confirmation of an already confirmed Team hires nothing. One code path, one id format, an activity entry per agent. **Recommended.**
2. Keep both paths, and accept that agents created at confirmation have no hire entry.

**Also here.** The Correspondent is stored as "Correspondente Qolmeia" by `apps/agents/src/company/organization.ts` and as "Correspondente" by the fallback upsert in `confirm.ts`. The UI prints its own label for agents that are not Workers (`packages/app-shell/src/agent-avatar.ts`), so the stored name is never shown. Pick one name, or stop storing one.

**Once decided.** With option 1, `workerIdFor` and the `createMany` in `confirmTeam` go. Existing derived ids stay valid; nothing needs rewriting.

## 6. Creating a Company has no screen

**Today.** `POST /api/backoffice/companies` (`apps/agents/src/routes/backoffice.ts`, `createOrganization`) creates the organization, the Company, its Planner and Correspondent, and the Template entitlements. No screen in `apps/backoffice` calls it; the backoffice only lists Companies and invites Customers into them.

**Check first.** How the Companies now in production were created (`SELECT id, name, slug, created_at FROM company ORDER BY created_at;`), and whether that is the way to keep.

**Options.**

1. Add a "Nova empresa" form to the backoffice Companies page. **Recommended:** onboarding a Customer should not need a terminal.
2. Keep it API-only and document the request in `docs/deploy.md`.

## 7. State read back from the activity log

**Today.** Two pieces of product state exist only as the newest activity entry of a type:

- When a member's prompt was last edited: the newest `MEMBER_PROMPT_EDITED` row (`apps/agents/src/team/roster.ts`).
- When a Company last got a proactive suggestion, which gates the next one: the newest `WORKER_PROACTIVE_SUGGESTION` row (`apps/agents/src/proactive/proactive.ts`).

**Why it is open.** Renaming an event type or pruning `activity_log` silently changes behaviour: a pruned log makes every Company eligible for a suggestion at once. The fix adds columns and backfills them, which is a staged schema change.

**Options.**

1. Add `agent_instance.prompt_override_updated_at` and `company.last_proactive_at`, written in the same transactions that record the activity. Order: push the two columns, backfill them from `activity_log`, then merge the Worker that reads them. **Recommended before the activity log gets any retention rule.**
2. Leave it, and treat those two event types as load-bearing: never rename or prune them.

**Once decided.** With option 1 the activity log is an audit trail only, and its types can be declared in the contracts and renamed freely.

## 8. Asset name and category in untyped metadata

**Today.** `asset.metadata` is free JSON with three writer conventions: uploads store `originalName` and brand assets also `category` (`apps/agents/src/routes/me-assets.ts`), `saveAsset` stores `name` (`apps/agents/src/skills/assets.ts`), and generated images store `aspectRatio` and `prompt` (`apps/agents/src/skills/generate-brand-image.ts`). Readers guess: `assetName` in `apps/agents/src/library/assets.ts` tries `name`, then `originalName`.

**Why it is open.** Real columns need a backfill of existing rows and a staged schema change.

**Options.**

1. Add `asset.name` and `asset.category`. Order: push the columns, backfill from `metadata`, then merge the Worker that reads and writes them. `metadata` keeps what is specific to one kind (aspect ratio, prompt). **Recommended once assets can be renamed or filtered by category in the database.**
2. Keep the JSON and give it one zod schema per asset kind, parsed on read. No schema change, and the guessing goes.

## 9. Templates without entitlement rows

**Today.** Every Company is entitled to every active Template: the rule is applied when a Company is created, when the seed runs (`packages/db/src/entitlement.ts`) and, since 2026-11-13, when a Template is created or set active in the backoffice (`apps/agents/src/template/template.ts`). A Template created in the backoffice before that date got no rows, so no Company can see or hire it.

**Check first.**

```sql
SELECT t.id, t.display_name, count(c.id) AS companies_without_it
FROM template t
CROSS JOIN company c
LEFT JOIN company_template_entitlement e ON e.template_id = t.id AND e.company_id = c.id
WHERE t.status = 'active' AND e.company_id IS NULL
GROUP BY 1, 2;
```

**Options, if it returns rows.**

1. Run the production seed (`pnpm --filter=@repo/db db:seed`), which entitles every Company to every active Template and overwrites no Template. **Recommended.**
2. Retire and restore each listed Template in the backoffice. While retired it cannot be hired.
3. Leave them hidden on purpose.

**The decision behind it.** ADR 0009 keeps `company_template_entitlement` as the gate for selling by module, but today the gate lets everything through and nothing can close it for one Company. When modules are sold separately, the rule "every Company gets every active Template" has to go from every place it is applied, and Operators need a screen to grant Templates per Company.

## 10. Two model runtimes

**Today.** The Planner and the Correspondent run on Flue (`apps/agents/src/agents`), whose tool input must be a Valibot schema. A Worker's deliverable is generated in the Workflow with the AI SDK's `generateText` (`apps/agents/src/jobs/worker-job-generate.ts`), whose tools take zod. Skills are written once in zod and converted for Flue (`apps/agents/src/skills/flue-tools.ts`). Every seeded Template runs GPT-6 through the Responses API (`apps/agents/src/lib/models.ts`).

**Why it is open.** Either unification changes what is sent to the model, and that cannot be shown equivalent without paid calls and a human reading the outputs.

**Options.**

1. Keep both until Flue accepts Standard Schema, then delete the converter. **Recommended.**
2. Generate deliverables on Flue: one more Durable Object class with stored state per Ticket, and a different request to the model.
3. Write skill inputs in Valibot: the brief would then exist in two schema libraries, because `extractBrief` shares its zod schema with `PATCH /api/me/company` and the web form.

**Check first.** For options 2 and 3, a recorded side-by-side of the same Tickets on both paths, read by a person.

## 11. How a Customer's roster stays fresh

**Today.** The Worker emits `team:roster` and `team:status` over a server-sent event stream after a use case that changes the roster or a status commits (`emitTeamEvent`, called from `team/`, `action/approval.ts` and `ticket/delegation.ts` in `apps/agents/src`). Delivery is best effort: a failed emit is swallowed and subscribers live in Durable Object memory. So the web app also polls every 30 seconds and refetches on window focus (`apps/web/src/lib/use-team-roster.ts`).

**Why it is open.** Removing the poll or the focus refetch changes how stale a Customer's roster can get when an event is lost. Making the stream reliable means storing events.

**Options.**

1. Keep all three. **Recommended:** the poll is what makes a best-effort stream acceptable.
2. Drop the stream and poll only: simpler, and status changes show up to 30 seconds late.
3. Make the stream durable (events stored and replayed by id), then drop the poll.

## 12. Two shapes for client writes

**Today.** Four writes go through React Query's `useMutation` (`apps/web/src/components/company-brief-form.tsx`, `brand-assets.tsx`, `apps/backoffice/src/components/use-template-form.ts`, `apps/backoffice/src/lib/use-toggle-template-status.ts`). The others are hand-written handlers with their own pending and error state (`decision-form`, `coverage-form` and `member-edit-form` in the backoffice, `empresa-client` in the web app). `AGENTS.md` documents both.

**Options.**

1. Leave existing forms alone and write new ones with `useMutation`. **Recommended:** converting five working forms buys no behaviour.
2. Convert them all, one PR per form.

## 13. An invitation whose e-mail fails

**Today.** `POST /api/backoffice/companies/:companyId/invitations` stores the invitation and records `CUSTOMER_INVITED` ("Convite enviado para …") before it sends the e-mail (`apps/agents/src/company/invitation.ts`, `apps/agents/src/routes/backoffice.ts`). When sending fails it answers 502 and the Operator sees an error, but the invitation and the activity entry stay. Inviting the same address again cancels the pending invitation and creates a new one (`packages/auth/src/organization.ts`), so a retry works.

**Options.**

1. Keep it: the retry heals it, and the activity feed occasionally says "sent" for an e-mail that was not. **Acceptable today.**
2. Record the activity entry only after the e-mail is accepted, and cancel the invitation when it is not. **Recommended when the activity feed is shown to anyone but Operators.**

## 14. `/assets/:id` refuses in plain text

**Today.** Every JSON endpoint refuses with `{ "error": … }`. `/assets/:id` answers `Not found` as plain text with 404 (`apps/agents/src/routes/assets.ts`), because it serves binary content to `<img>` and download links.

**Options.**

1. Keep plain text. **Recommended:** nothing parses the body of a failed image request.
2. Answer JSON like the rest, which changes a response the two apps proxy.
