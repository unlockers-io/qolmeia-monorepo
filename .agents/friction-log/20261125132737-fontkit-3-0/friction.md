---
title: 'fontkit 3.0.0 fails the landing build while prerendering the opengraph image'
severity: 'minor'
target: 'fontkit'
---

`@repo/social-image` imports `create` from fontkit. With fontkit 3.0.0, `next build` on apps/landing fails prerendering `/` with `TypeError: The "path" argument must be of type string or an instance of Buffer or URL. Received an instance of URL`, raised from `src/app/opengraph-image--metadata.js` at module evaluation. Unit tests and typecheck pass, only the Turbopack build breaks.

fontkit stays at 2.0.4.

Expected: fontkit 3 loading under Next 16 with Turbopack, or a documented entry point that reads no files at import time.
