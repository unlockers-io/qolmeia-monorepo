# Qolmeia

An AI marketing agency: each customer company gets a Team of AI agents that does marketing work, with human operators approving sensitive actions before they ship.

## Language

### Actors

**Company**:
A customer tenant. Its id (`companyId`) is the unit of isolation **for the customer surface**: the `/agents/<name>/<companyId>`, `/api/me/*` and `/api/teams/*` paths take `companyId` from the session and never trust it from the URL (ADR 0001). It is also the Durable Object instance id every agent is keyed by. Operators are cross-tenant and reach any Company by role, not by membership (ADR 0005).
_Avoid_: org, tenant, client

**Account**:
A login that belongs to a Company (the `CUSTOMER` role). A Company has one or more Accounts; they all share the Company's surface and agents.
_Avoid_: user, seat

**Customer**:
The role of an Account: an end-user of a Company who chats with its agents. Used for the human; **Account** is the login record. A Customer belongs to exactly one Company, and every request on the customer surface acts in it (ADR 0011).
_Avoid_: user, end user

**Operator**:
Qolmeia platform staff who vet AI prompts and results: the human quality layer, and the product's differentiator. The `OWNER`/`STAFF` members of the single internal **Qolmeia org**; they belong to no customer Company and are authorized by role, acting on any Company through backoffice REST (never an agent connection). The Company acted on comes from the URL; the session only proves the role (ADR 0011). An Operator may have optional assigned Companies and disciplines (ADR 0005).
_Avoid_: admin, moderator, customer

**Surface**:
One of the two audiences the Worker serves: the **customer surface** (the web app, the `CUSTOMER` role) and the **operator surface** (the backoffice, the `OWNER`/`STAFF` roles). Each role belongs to exactly one surface.
_Avoid_: app, portal, side

**Identity**:
Who a request acts as: the caller's membership on the surface the request calls, resolved by the Worker on every request. A request is signed in, signed out, unavailable (the auth store failed; never treated as signed out), or forbidden (no membership on that surface). No client names a Company or org (ADR 0011).
_Avoid_: session, current org, principal

**Assignment**:
The optional link from an Operator to the Companies and disciplines they cover, used to route the approval queue. No assignment means the Operator sees everything.
_Avoid_: scope, permission

**Discipline**:
The kind of work an Action represents (`design`, `copy`, `strategy`, `social`…), derived from the producing agent's `worker_kind`. Routes an Action to the Operator who reviews that craft.
_Avoid_: category, tag, type, skill

### Agents

**Correspondent**:
The single point of contact for a Company, one per Company. Talks to the Customer, delegates specialist work, and presents finished deliverables back in chat.
_Avoid_: assistant, bot, concierge

**Planner**:
The onboarding-interview agent that runs before a Team exists: it debriefs the Company and proposes a Team.
_Avoid_: onboarder, setup agent

**Worker**:
A specialist agent instantiated from a Template (e.g. Designer, Marketing Strategist) that produces a specific kind of deliverable.
_Avoid_: specialist bot, sub-agent

**Team**:
The confirmed set of agents (one Correspondent + its Workers) for a Company. Materialized when the Customer confirms during onboarding.

### Work

**Brief**:
The structured profile of a Company's business: industry, primary goal, audience, channels, and brand (voice, palette, references). Drives what the agents produce; "complete" means all of those are filled. A selected **channel** carries its URL (a bare checkbox without the link is meaningless).
_Avoid_: profile, questionnaire

**Ticket**:
A unit of delegated work the Correspondent hands to a Worker; tracked through `in_progress` → `awaiting_approval` → `done`, or `rejected` when a Decision ends it.
_Avoid_: task, job

**Action**:
The effect a Ticket proposes once its Worker has generated, one per round (e.g. release a deliverable, publish a post). Distinct from a Ticket: the Ticket is the work, the Action is the effect. Its **Policy** decides whether it executes at once, executes and notifies, or waits for an Operator's **Decision** (ADR 0006). Nothing reaches the customer until its Action executes.
_Avoid_: approval, request

**Action type**:
The kind of effect an Action has (`worker_deliverable`, `publish_post`). Each is declared once, as a module that builds the proposed payload from what the Worker generated, executes the effect, and names its default Policy. A Template names the Action type its Worker proposes.
_Avoid_: action kind, category

**Deliverable**:
The artifact a Worker produces: a generated image, copy, a research brief. It is generated into the agent folder and promoted to the customer folder when its Action executes. `worker_deliverable` defaults to `auto-execute`, so deliverables reach the customer without review unless their Template gates them.
_Avoid_: output, result, asset

**Policy**:
The gating tier of an Action: `auto-execute` (executes at once), `notify-only` (executes at once and records an entry for an Operator to spot-check), `require-approval` (waits for an Operator's Decision). Each Action type has a default; a Template's `default_policies` overrides it per type, and an unrecognised value fails closed to `require-approval`. Only outward, hard-to-reverse Actions get `require-approval`.
_Avoid_: rule, permission, gate

**Decision**:
An Operator's verdict on a gated Action: **approve** (it executes), **reject** (the Ticket ends `rejected` and nothing reaches the customer folder), or **request-changes** (a revise loop: the feedback returns to the Worker, which regenerates and proposes a new Action; at most three rounds, after which the Ticket ends `rejected`). Recording the Decision and executing the Action are separate steps. The customer sees only the final executed Deliverable.
_Avoid_: review, vote, outcome

### Storage

**Library**:
A Company's files, split into two **folders**: the **customer folder** (visible to the customer and the agents: finished work, the customer's uploads, and brand identity) and the **agent folder** (agent-only working material: scrapes, drafts, and deliverables whose Action has not executed). The `asset` row is the authority and its `visibility` (`customer`/`agent`) is the folder; the bytes sit in R2 and never move, so promoting an asset is one row update (ADR 0007). Persisted content refers to an asset as `/assets/<id>`.
_Avoid_: assets, files, bucket

**Memory**:
The agent's semantic recall of important facts, saved on purpose with `rememberFact` and retrieved with `recallMemory`. A fact is a `memory_fact` row, the authority, plus its vector in Cloudflare Vectorize, used only to find it. Distinct from the **Library**: a fact is not a file.
_Avoid_: knowledge base, context, RAG
