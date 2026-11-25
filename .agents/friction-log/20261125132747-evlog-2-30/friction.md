---
title: 'evlog 2.30 and later logs a raw `Error` field in full, so the serialize-error test fails'
severity: 'minor'
---

### Expected Behavior

`pnpm test` passes on the latest evlog.

### Current Behavior

packages/observability/src/serialize-error.test.ts asserts that evlog writes an `Error` held in a field as `{}`. From evlog 2.30.0 the field is logged with its name, message and stack, so that test fails on any newer evlog. evlog stays at 2.29.0 for now.

### Possible Solution

Both the test and `serialize-error.ts` are written by `standy sync`, so the standard has to drop the assertion or drop the serializer before evlog can move.

### Minimal Reproducible Example

```bash
pnpm --filter @repo/observability add evlog@2.37.1
pnpm --filter @repo/observability test
```

### Context

Found while updating all the dependencies.
