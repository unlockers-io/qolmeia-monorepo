---
title: 'Workflow introspector ignores falsy mock step results'
severity: 'minor'
target: '@cloudflare/vitest-plugin'
---

### Current Behavior
Calling mockStepResult({ name: "notify-executed-0" }, null) does not replace the Workflow step. The real callback runs and attempts an unconfigured Flue dispatch instead. This blocked isolated Workflow notification tests.

### Minimal Reproducible Example
Use @cloudflare/vitest-plugin 1.4.3 with its bundled Miniflare, register a mock step result of null (or another falsy value), then create the Workflow instance. The original callback executes. The bundled workflows binding tests replaceResult by truthiness before applying it.

### Expected Behavior
Every explicitly registered result, including null, false and zero, should replace the callback. The remediation tests use a truthy admission receipt as the workaround.
