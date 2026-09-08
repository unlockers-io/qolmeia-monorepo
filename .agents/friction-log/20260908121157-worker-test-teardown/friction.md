---
title: "Worker test teardown leaves fixture server children running"
severity: "minor"
---

A full local pnpm test run completes all 40 Cloudflare worker test files and 258 assertions, but the task keeps running because the API and fixture-server child Node processes still own ports 4010 and 4011. The global setup spawns pnpm wrappers and kills those wrappers during teardown, leaving their tsx children alive on macOS. Sending SIGTERM only to the two verified child processes from the isolated test worktree allowed all 16 Turbo tasks to exit successfully. Follow up by making test fixture teardown own and await the entire child process tree; do not touch unrelated local services.
