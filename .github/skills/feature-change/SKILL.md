---
name: feature-change
description: "Structured workflow for changing functionality safely in this project. Use for new behavior, logic updates, bug fixes, and refactors in the webapp."
argument-hint: "Describe the functional behavior you want to add or change"
user-invocable: true
---
# Feature Change Skill

## When to use
- Add or adjust order behavior
- Change state transitions
- Add form fields or validation
- Refactor app logic with behavior parity

## Procedure
1. Capture expected behavior using [request template](./templates/request-template.md).
2. Identify affected files and edge cases using [impact checklist](./references/impact-checklist.md).
3. Implement smallest viable code change.
4. Verify core flow manually:
   - create order
   - edit order
   - advance status
   - delete order
5. Summarize result against acceptance criteria.

## Resources
- [request template](./templates/request-template.md)
- [impact checklist](./references/impact-checklist.md)
