# Approval gates only high-impact actions; three policy tiers; request-changes is a revise loop

ADR 0005 made Operators the human quality layer. That could have meant "a human reviews every AI deliverable before the customer sees it." It does not. We gate only what has **real, outward, hard-to-reverse impact** — the rest flows straight to the customer.

**Decision:**

- **Gate scope.** `require-approval` is reserved for actions that leave the system or can't be cheaply undone: publishing a post, sending an email, scheduling a go-live, spending ad budget. Pure **deliverables** — a generated image, copy, a research brief, any internal artifact — `auto-execute`: they land in the customer's chat / asset library with no blocking review. Vetting everything would bury the operator and slow the customer for little gain; we vet what matters.

- **Three policy tiers**, declared per action-type on the producing agent's template (`default_policies`):
  - **auto-execute** — runs immediately, nobody notified (deliverables, internal work).
  - **notify-only** — runs immediately (non-blocking) but is surfaced to an operator feed for after-the-fact spot-check / audit. The home for "lighter-touch monitoring."
  - **require-approval** — blocks on the Workflow's `waitForEvent("decision-<id>")` until an operator decides.

- **Gated actions are discipline-routed** to the matching operator (ADR 0005): a `publish_post` from the Designer's work reaches the design reviewer, etc.

- **Decision outcomes:**
  - **approve** → the action executes; the deliverable is released to the customer.
  - **reject** → the ticket terminates; nothing ships.
  - **request-changes** → a **revise loop**: the operator's written feedback goes back to the **Worker agent**, which regenerates and re-proposes; operator and agent iterate until approve or reject. The loop is **operator↔agent** — the customer sees only the final approved result in chat, never the back-and-forth.

## Consequences

- The Workflow loops on `request-changes`: the feedback goes back to the Worker, which regenerates and re-proposes a new Action for the next round, and the Workflow waits again.
- A **soft cap** of three revise rounds (`MAX_REVISIONS`) applies in both the decide route, which refuses a change request at the cap, and the Workflow, which ends the Ticket as rejected if one arrives anyway. The operator can always reject to end it.
- Approval controls the effect. Generation writes the Worker's files to the agent folder; the Action executes only after it is cleared (immediately for `auto-execute` and `notify-only`, after approval for `require-approval`), and its action type's executor promotes those files to the customer folder and presents the result. A rejected Action's files never reach the customer folder.
- Each action type declares its default policy next to its proposed payload and executor (`publish_post`: `require-approval`; `worker_deliverable`: `auto-execute`). A template's `default_policies` entry overrides it per action type, overridable per-company later if needed.
- **notify-only** still needs a real destination: it records an `ACTION_NOTIFY` activity entry, and an operator monitoring feed distinct from the blocking queue is a follow-up. No seeded template uses it.
