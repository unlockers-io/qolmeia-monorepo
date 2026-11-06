---
title: 'anti-slop no-known-value-widening flags the mapped-type annotation correlated unions need'
severity: 'minor'
target: 'oxlint-config-awesomeness'
---

TypeScript only correlates `RECORD[key].fn(...)` for a generic `key` when the record is annotated with a mapped type such as `{ [T in ActionType]: ActionTypeModule<T> }` (microsoft/TypeScript#47109); `satisfies` keeps the per-key literal type and loses the correlation. `anti-slop(no-known-value-widening)` warns on that inline annotation, so apps/agents/src/action/action-types.ts introduces a one-use `ActionTypeModules` alias just to silence it.

Expected: the rule accepts an annotation that is a mapped type over a finite union, since it does not widen anything.
