# PR #205 screenshots

Captured on 29 September 2026 from the local branch with the seeded Qolmeia Dev
company. These are current-state captures, not before/after comparisons. No
production customer data is shown.

| Surface                                                 | Desktop                                         | Mobile                                                  |
| ------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------- |
| Landing and invitation path                             | [1440 × 1000](landing-desktop.png)              | [390 × 844](landing-mobile.png)                         |
| Customer chat: revision/rejection notices and composer  | [Desktop](web-chat-desktop.png)                 | [390 × 844](web-chat-mobile.png)                        |
| Approval: rendered proposal, feedback and operator name | [1440 × 1000](backoffice-revision-desktop.png)  | [379 × 1684, full page](backoffice-revision-mobile.png) |
| Ticket: bounded layout and revision history             | [1440 × 1000](backoffice-ticket-desktop.png)    | —                                                       |
| Dashboard: independent counters and recent activity     | [1440 × 1000](backoffice-dashboard-desktop.png) | —                                                       |
| Coverage: readable discipline labels                    | [1440 × 1000](backoffice-coverage-desktop.png)  | —                                                       |

The customer chat and backoffice captures above use the dark theme. Both apps
follow the system color preference; the additional captures below use browser
`prefers-color-scheme: light`. The landing captures above already show its light
appearance. The gallery contains 16 screenshots in total.

## Light theme

| Surface                                                 | Desktop                                               | Mobile                                                        |
| ------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------- |
| Customer chat: revision/rejection notices and composer  | [1440 × 844](web-chat-light-desktop.png)              | [390 × 844](web-chat-light-mobile.png)                        |
| Approval: rendered proposal, feedback and operator name | [1440 × 1000](backoffice-revision-light-desktop.png)  | [379 × 1684, full page](backoffice-revision-light-mobile.png) |
| Ticket: bounded layout and revision history             | [1440 × 1000](backoffice-ticket-light-desktop.png)    | —                                                             |
| Dashboard: independent counters and recent activity     | [1440 × 1000](backoffice-dashboard-light-desktop.png) | —                                                             |
| Coverage: readable discipline labels                    | [1440 × 1000](backoffice-coverage-light-desktop.png)  | —                                                             |

Screenshots show the development server, including its Next.js indicator. The
original E2E conversation predates the model upgrade. The light chat captures also
include a later smoke-test exchange with the updated model. These captures
document UI behavior; they are not a model-quality evaluation.
