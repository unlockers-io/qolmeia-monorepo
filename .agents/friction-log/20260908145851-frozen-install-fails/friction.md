---
title: "Frozen install fails on stale Better Auth peer snapshot"
severity: "major"
---

A fresh frozen install of the main-branch lockfile fails with ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY. The packages/ui Better Auth importer references mysql2 3.15.3 and an older Prisma peer shape, while the lockfile only contains the already-pinned mysql2 3.24.3 snapshot with the current Node types. Point the importer at that existing snapshot; do not re-resolve unrelated package versions. The React Doctor remediation PR includes this one-line repair and verifies a frozen install.
