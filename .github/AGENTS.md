# Agent operating guide for NailsbyYG

## Default behavior

- Keep changes small and scoped to the requested task.
- Prefer the simplest implementation that meets the requirements.
- Ask for clarification when requirements are ambiguous.
- Use the existing repository conventions and keep code readable.

## Verification requirements

Before finishing a task, verify with the relevant checks:

- `npm run check`
- `npm run test:worker`
- `npm run test:e2e`

Use the smallest relevant test scope when the change is small.
