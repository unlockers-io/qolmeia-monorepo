# Agent tools & integrations

What the Qolmeia agents can do today, and the integrations worth adding next,
each mapped to the agent(s) that use it. Companion to
[`docs/deploy.md`](./deploy.md).

## Two ways an agent reaches the outside world

1. **Skill**: a code module in `apps/agents/src/skills/` built with
   `defineSkill({ id, displayName, description, inputSchema, execute })` and
   listed in `ALL_SKILLS` (`skills/registry.ts`). The module is the whole
   contract: the registry derives the Flue tool (Correspondent, Planner), the AI
   SDK tool (specialist Workflow runs), and the backoffice catalog entry from it.
   An agent only gets a skill if its skill set lists the id: the **Correspondent**
   and **Planner** have hardcoded sets (`CORRESPONDENT_SKILLS`, `PLANNER_SKILLS`);
   **specialist Workflow runs** get `template.skillIds`. The `skill` table holds
   only an operator kill-switch: a row with `enabled = false` hides the skill from
   every agent from its next turn or generation step; a missing row means enabled.
2. **Channel**: how the customer reaches the Correspondent. Today the only
   channel is the **web chat** (the Correspondent's Flue agent route, HTTP+SSE).
   There are no external messaging connectors; Flue's `channels/` convention is
   reserved for future inter-agent transport.

Outward, hard-to-reverse tools (publishing, sending, spending) should propose a
**gated action** (`require-approval` policy, ADR 0006) rather than firing
directly. Skills never cause the effect themselves: a Worker job's skills write
to the agent folder, and the template's Action type executes only once its
Policy clears it. The shipped templates gate only the Marketing Strategist's
`publish_post`; the Designer's, Redator's, and SEO Researcher's
`worker_deliverable` actions `auto-execute`. `notify-only` is available as a
template policy; no shipped template uses it.

## Current tools (live)

| Tool (skill)                             | What it does                              | External dep                                     | Used by                                |
| ---------------------------------------- | ----------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| `webSearch`                              | web search                                | **Exa** (`EXA_API_KEY`)                          | Correspondent + all workers            |
| `fetchUrl`                               | read a page as markdown                   | **Firecrawl** (`FIRECRAWL_API_KEY` or self-host) | Correspondent + all workers            |
| `generateBrandImage`                     | image generation                          | OpenRouter image model, through AI Gateway       | Designer                               |
| `draftSocialPost`                        | structured post draft (platform/body/CTA) | — (LLM)                                          | Marketing Strategist                   |
| `listAssets` / `readAsset` / `saveAsset` | the Library                               | R2                                               | Correspondent + all workers            |
| `rememberFact` / `recallMemory`          | semantic memory                           | Postgres + Workers AI + Vectorize                | Correspondent + all seeded specialists |
| `delegateToWorker`                       | spawn a child ticket                      | —                                                | Correspondent                          |
| `extractBrief`                           | update the company brief                  | — (LLM)                                          | Planner, Correspondent                 |
| `proposeTeam`                            | onboarding team proposal                  | — (LLM)                                          | Planner                                |

**Channel:** web chat only: the Correspondent's Flue agent route (HTTP+SSE).

### Agent → tools today

- **Correspondent**: `rememberFact`, `recallMemory`, `delegateToWorker`,
  `extractBrief`, `listAssets`, `readAsset`, `saveAsset`, `webSearch`, `fetchUrl`
- **Planner**: `extractBrief`, `proposeTeam`
- **Designer**: `generateBrandImage` + assets + web + memory
- **Marketing Strategist**: `draftSocialPost` + assets + web + memory
- **Redator**: `webSearch`, assets, memory (+ `fetchUrl`)
- **SEO Researcher**: `webSearch`, assets, memory (+ `fetchUrl`)

## Recommended additions

Ordered roughly by value. "Type" is **skill** (agent action) or **connector**
(channel). Publishing/sending ones should be `require-approval`.

| Integration                                           | Value                                                                   | Type      | Agent(s)                                   | Needs                                                 | Gating                                         |
| ----------------------------------------------------- | ----------------------------------------------------------------------- | --------- | ------------------------------------------ | ----------------------------------------------------- | ---------------------------------------------- |
| **WhatsApp** (Cloud API / Twilio)                     | the dominant pt-BR customer channel: inbound+outbound chat              | connector | Correspondent                              | Meta WhatsApp Business or Twilio creds (KV) + webhook | n/a (channel)                                  |
| **Email send** (`sendEmail`)                          | outbound campaigns / replies; Resend is already wired for transactional | skill     | Marketing Strategist, Correspondent        | reuse `RESEND_API_KEY` (or per-tenant domain)         | require-approval                               |
| **Instagram / Meta Graph** (`publishPost`)            | actually publish the Strategist's drafts + read reach/insights          | skill     | **Social Media Manager** (new), Strategist | Meta app + per-tenant OAuth token (KV)                | require-approval                               |
| **Gmail / inbound email**                             | treat email as a Correspondent channel (parse + reply)                  | connector | Correspondent                              | Gmail API OAuth or IMAP (KV) + webhook/poll           | n/a                                            |
| **Google Calendar** (`scheduleEvent`)                 | content calendar, go-live dates, reminders                              | skill     | Planner, Strategist                        | Google OAuth (KV)                                     | notify-only                                    |
| **Google Drive / Sheets**                             | read/write content calendars & long docs beyond the asset library       | skill     | Redator, Strategist                        | Google OAuth (KV)                                     | auto-execute (read) / require-approval (write) |
| **LinkedIn** (`publishPost`)                          | B2B publishing                                                          | skill     | Social Media Manager                       | LinkedIn app + OAuth (KV)                             | require-approval                               |
| **Analytics** (GA4 / Meta Insights) (`readAnalytics`) | close the loop: measure what shipped                                    | skill     | SEO Researcher, Strategist                 | GA4 / Meta tokens (KV)                                | auto-execute                                   |
| **Slack / Discord**                                   | team-channel connector for orgs that live there                         | connector | Correspondent                              | bot token (KV) + webhook                              | n/a                                            |
| **Stock / Canva / Figma**                             | source or templatize visuals                                            | skill     | Designer                                   | provider API key                                      | auto-execute                                   |

### Suggested new agent

- **Social Media Manager**: owns the publishing surface (`publishPost` across
  Instagram/LinkedIn + `scheduleEvent`). Distinct from the **Marketing
  Strategist**, which _drafts_ (`draftSocialPost`); the Manager _ships_ on a
  schedule. Its `publish_post` actions route to the `social` discipline in the
  operator approval queue (ADR 0005 coverage).

## Roadmap: the first non-marketing vertical (Cobrança + Comercial)

Everything above is the **marketing** vertical. Per ADR 0009 the platform is
vertical-agnostic: a new vertical is templates + skills + connectors, not a new
engine. Customer discovery (a coworking operator) ranked **collections,
pre-sales, and a light CRM** far above marketing, with `automação assistida +
aprovação antes de ação sensível` as the gating requirement (already the ADR
0006 loop). This is the first vertical to build out.

### New agents (templates)

- **Agente de Cobrança** (`workerKind: collections`): open-invoice panel,
  reminders, approved-message follow-up. `defaultActionType:
send_collection_message`, `default_policies: { send_collection_message:
require-approval }`.
- **Agente Comercial / Pré-atendimento** (`workerKind: sales`): leads,
  orçamentos, retornos, follow-up; acts as the light CRM's system of record.

### New skills

| Skill                      | What it does                            | Type  | Agent     | Gating        |
| -------------------------- | --------------------------------------- | ----- | --------- | ------------- |
| `listOpenInvoices`         | read cobranças em aberto (synced)       | skill | Cobrança  | auto-execute  |
| `draftCollectionReminder`  | draft an approved-tone cobrança message | skill | Cobrança  | — (LLM draft) |
| `scheduleFollowUp`         | queue the next cobrança touch           | skill | Cobrança  | notify-only   |
| `createLead` / `listLeads` | CRM lead capture + listing              | skill | Comercial | auto-execute  |
| `draftQuote`               | draft an orçamento                      | skill | Comercial | — (LLM draft) |
| `logInteraction`           | record a commercial touch               | skill | Comercial | auto-execute  |

### New connectors (the gating dependency)

| Connector                     | Why                                                         | Needs                                       | Gating           |
| ----------------------------- | ----------------------------------------------------------- | ------------------------------------------- | ---------------- |
| **WhatsApp** (Cloud API)      | dominant pt-BR channel: outbound cobrança + pré-atendimento | Meta WhatsApp Business creds (KV) + webhook | n/a (channel)    |
| **Financial system** (Conexa) | read open invoices + client list (complement, not replace)  | provider API creds (KV)                     | auto (read)      |
| **NF / prefeitura**           | emissão de nota fiscal; high-trust, later                   | municipal integration creds (KV)            | require-approval |

### Smallest slice that proves the model

WhatsApp **outbound** + `listOpenInvoices` (manual sync to start) +
`draftCollectionReminder` + a `send_collection_message` action type/renderer +
one Agente de Cobrança template. Exercises every new layer end-to-end while
reusing the entire approval engine; matches the customer's willingness-to-pay
(R$150 for cobrança + pré-atendimento). Reporting (cobranças em aberto / vendas
/ DRE) and modular entitlements (ADR 0009) follow.

### Document previews: Extend UI (deferred to this vertical)

[Extend UI](https://www.extend.ai/ui/docs) (MIT, shadcn copy-in) is the chosen
viewer stack for when Cobrança produces **documents**: boletos / NF (PDF) and a
DRE (XLSX). Deferred until then because today's deliverables are only images +
markdown; the viewers would ship heavy and idle. Integration notes from a
spike (2026-06-19):

- **Do NOT use `npx shadcn add @extend/<name>`.** Even with `--yes` it stops on
  an interactive "overwrite button.tsx?" prompt and wants to clobber our
  customized `@repo/ui` primitives. Copy the registry JSON's source in by hand
  instead.
- Each viewer pulls a heavy renderer (`csv-viewer` → `@glideapps/glide-data-grid`
  - `papaparse`; PDF → pdf.js; XLSX → sheetjs) and **Hugeicons**: swap those to
    **lucide** to match our `iconLibrary`. Register the namespace with
    `"registries": { "@extend": "https://www.extend.ai/ui/r/{name}.json" }` in
    `packages/ui/components.json`.
- `csv-viewer` also needs 5 primitives we don't have yet (`popover`, `select`,
  `separator`, `spinner`, `tooltip`); add them from the `base-nova` registry
  (they don't exist, so no overwrite prompt).
- Wire a `mime → viewer` dispatcher + a preview dialog into the Assets gallery,
  behind `next/dynamic` so the renderers stay out of the main bundle.

## How to wire a new one (checklist)

**Skill:**

1. Create `apps/agents/src/skills/<name>.ts` exporting
   `defineSkill({ id, displayName, description, inputSchema, execute })`.
   `inputSchema` is a top-level `z.object`; `.describe()` every field, and avoid
   unions and nullables (the Flue bridge rejects them). `execute(input, ctx)`
   receives the parsed input.
2. Add the skill to `ALL_SKILLS` in `apps/agents/src/skills/registry.ts`.
3. List its id where an agent should use it: a specialist template's `skillIds`
   (backoffice template form; `DEFAULT_TEMPLATES` in
   `packages/db/src/product-seed.ts` for a shipped template), or
   `CORRESPONDENT_SKILLS` / `PLANNER_SKILLS`. The backoffice rejects unknown ids.

Declare any secret in `env.d.ts` + `wrangler secret put` + `docs/deploy.md`. A
skill that writes to the library uses `ctx.deliverableFolder`, so a Worker job's
files stay in the agent folder until its Action executes. A skill that calls a
model goes through `apps/agents/src/lib/models.ts`.

**Action type:** add the key to `ACTION_TYPES` in
`packages/worker-api/src/contracts/actions.ts` → add a module under
`apps/agents/src/action/` with its proposed-payload extraction, executor, and
default policy (`require_approval` for outward, hard-to-reverse effects) → register
it in `ACTION_TYPE_MODULES` → add its backoffice renderer, label, and default
decision (the typed records fail to compile until you do).

**Connector:** none exists yet. The first one adds a webhook route that
`dispatch()`es inbound messages to the Correspondent, and a per-tenant secret
store keyed by company id for OAuth tokens and channel secrets, never env vars
or product tables.
