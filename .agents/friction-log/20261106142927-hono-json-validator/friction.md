---
title: 'Hono json validator validates `{}` when the Content-Type is not JSON'
severity: 'minor'
target: 'honojs/hono'
---

The `json` target of `hono/validator` (and so `@hono/zod-validator`) skips parsing when the request Content-Type does not match its internal JSON regex and validates `{}` instead. A schema whose fields are all optional (a PATCH body) then succeeds, so a request sent without `content-type: application/json` returns 200 and writes nothing. apps/agents/src/lib/validate.ts has to copy the regex Hono does not export and answer 415 from the hook.

Expected: an option (or default) that answers 415 when the Content-Type is not JSON, or an exported matcher so callers do not duplicate the regex.
