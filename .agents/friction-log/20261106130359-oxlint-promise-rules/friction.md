---
title: 'oxlint promise rules flag zod `.catch()` as a Promise chain'
severity: 'minor'
target: 'oxlint-config-awesomeness'
---

promise/prefer-await-to-then, unicorn/prefer-top-level-await and promise/valid-params fire on zod schema fallbacks such as `z.enum(VALUES).catch("other")` and `z.catch(schema, value)`, which are not Promises. The idiomatic zod fallback cannot be written without a disable comment, so code falls back to `schema.safeParse(value).data ?? fallback` by hand (seen in apps/agents/src/template/template.ts and routes/me-assets.ts).

Expected: the promise rules only flag receivers typed as PromiseLike, or the config turns them off where type information is unavailable.
