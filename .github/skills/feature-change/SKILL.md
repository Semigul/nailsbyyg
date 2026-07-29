---
name: feature-change
description: "Structured workflow for changing functionality safely in this project. Use for new behavior, logic updates, bug fixes, and refactors in the webapp."
argument-hint: "Describe the functional behavior you want to add or change"
user-invocable: true
---
# Feature Change Skill

## Procedure
1. Capture expected behavior using [request template](./templates/request-template.md).
2. Identify affected files and edge cases using [impact checklist](./references/impact-checklist.md).
3. Map every changed behavior to an existing or new Playwright scenario in `tests/e2e/`.
4. Implement the smallest viable product change and its tests in the same change:
   - Add or update an E2E test for every new behavior.
   - Reproduce a bug in a test before or alongside its fix.
   - Do not weaken or remove assertions unless the corresponding behavior is intentionally removed.
5. Run `npm test`. Fix failures before committing or pushing.
6. Summarize the result and name the tests that prove each acceptance criterion.

## Resources
- [request template](./templates/request-template.md)
- [impact checklist](./references/impact-checklist.md)
