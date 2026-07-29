---
name: github-pages-release
description: "Release workflow for GitHub Pages with preflight checks, mobile-first validation, and deployment readiness. Use for publish, deploy, release, and pages troubleshooting."
argument-hint: "Describe the release goal, for example: preflight before push to main"
user-invocable: true
---
# GitHub Pages Release Skill

## When to use
- Before releasing this webapp to GitHub Pages
- When GitHub Pages deployment fails
- When validating release quality gates

## Procedure
1. Verify release criteria in [release requirements](../../instructions/release-requirements.instructions.md).
2. Run [preflight script](./scripts/preflight.sh) from the repository root.
3. Confirm [deploy workflow](../../workflows/deploy-pages.yml) exists and points to root static files.
4. Check that no secret config files are committed.
5. Confirm that `npm test` passed and that Pages deployment depends on the E2E job.
6. Return a pass/fail checklist and next action.

## References
- [Release checklist](./references/checklist.md)
