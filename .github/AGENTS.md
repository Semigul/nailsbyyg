# Agent operating guide for NailsbyYG

## Default behavior

- Keep changes small and scoped to the requested task.
- Prefer the simplest implementation that meets the requirements.
- Ask for clarification when requirements are ambiguous.
- Use the existing repository conventions and keep code readable.

## Workflow triggers

- If an issue is labelled `needs-refinement`, create a concise refinement summary before implementation.
- If an issue is labelled `ready-for-dev`, implement the change and keep the PR focused.
- If a PR is labelled `ready-for-review`, review for correctness, security, maintainability, and test coverage.
- If a PR is labelled `ready-for-staging`, prepare the change for staging review and confirm that the relevant checks passed.

## Verification requirements

Before finishing a task, verify with the relevant checks:

- `npm run check`
- `npm run test:worker`
- `npm run test:e2e`

Use the smallest relevant test scope when the change is small.
