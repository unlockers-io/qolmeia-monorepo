---
title: 'next build logs "failed to load" errors for /activity, /assets and the backoffice home on a clean build'
severity: 'minor'
issue: 'unlockers-io/qolmeia-monorepo#268'
---

### Expected Behavior

A clean `next build` of web and backoffice prints no `level: "error"` logs when nothing failed.

### Current Behavior

`pnpm turbo run build --filter=web --filter=backoffice --force` on main (d7548c5) prints six `level: "error"` lines with an empty `error: {}`: "activity: failed to load" and "assets: failed to load" from web, "home: failed to load recent activity" from backoffice, two each. The build still succeeds, so real failures in the build output look the same as this noise.

### Possible Solution

Those loaders wrap `apiGetServer` in a try/catch and call `log.error`, so whatever rejects while prerendering gets logged as a failure. Check what the rejection is (likely the cacheComponents prerender abort), then rethrow it or skip logging it in those loaders.

### Minimal Reproducible Example

```bash
pnpm install --frozen-lockfile
pnpm turbo run build --filter=web --filter=backoffice --force 2>&1 | grep 'failed to load'
```

### Context

Seen while comparing build output for the Skullet loading-state trial; the same six lines show up with and without that change.
