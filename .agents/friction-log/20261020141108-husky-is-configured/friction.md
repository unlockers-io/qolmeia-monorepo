---
title: 'Husky is configured without an authored pre-commit hook'
severity: 'minor'
issue: 'unlockers-io/qolmeia-monorepo#255'
---

### Expected Behavior
AGENTS.md describes Husky and lint-staged checking staged source before commits.

### Current Behavior
The package prepare script installs Husky and core.hooksPath points to .husky/_, but no .husky/pre-commit is tracked. The generated wrapper exits successfully without running lint-staged. Explicit lint, formatting, focused tests, build and Standy checks passed for the source correction.

### Possible Solution
Restore the documented pre-commit hook or update the documentation in a tooling change. Until then, run the required checks explicitly before committing.

### Minimal Reproducible Example
Run git ls-files .husky and inspect .husky/pre-commit: no authored hook is tracked or present. A normal commit has no lint-staged output.

### Context
Observed during audit remediation when a normal source commit completed without the documented staged checks. CI still checks the full repository.
