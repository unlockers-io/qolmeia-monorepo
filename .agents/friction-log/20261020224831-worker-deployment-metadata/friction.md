---
title: 'Worker deployment metadata does not guarantee the source commit'
severity: 'minor'
---

### Expected Behavior
The production runbook should explain how to recover the exact Git commit of the active Worker.

### Current Behavior
`docs/deploy.md` says `wrangler deployments list` shows the commit, but recent production deployments have empty annotations and `versions view` has no commit field. A production bundle can contain merged changes while its required database schema is still absent, so READY builds alone cannot establish a coordinated rollout.

### Possible Solution
Record the deployed commit in the Worker deployment message, and cross-check the Workers Builds record when a version lacks commit metadata. Keep schema verification separate from application deployment status.

### Minimal Reproducible Example
From apps/agents run `pnpm exec wrangler deployments list --json`, then `pnpm exec wrangler versions view <active-version-id> --json`, and inspect annotations and metadata for the source commit. Neither response guarantees a commit hash.

### Context
Observed while checking the production schema and Worker rollout after fleet remediation. The active Worker contained the new memory and notification code, but the database still lacked the indexed_at column. The runbook claim prevented a direct revision check.
