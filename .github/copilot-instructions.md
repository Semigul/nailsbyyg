# Copilot instructions for NailsbyYG

## Project context

This repository contains a web app for NailsbyYG with client-side JavaScript, Firebase integration, Playwright tests, and a worker package for notifications.

## Working rules

- Prefer small, focused changes over large rewrites.
- Follow the existing code style and naming patterns already used in the repository.
- Keep changes compatible with the current static web app setup.
- When a task is not fully clear, ask for clarification instead of making risky assumptions.
- For user-facing changes, consider mobile-first usability and accessibility.

## Agent workflow

- If an issue is labelled `needs-refinement`, first produce a short refinement note with:
  - the problem statement
  - acceptance criteria
  - the implementation approach
  - any risks or open questions
- If an issue is labelled `ready-for-dev`, implement the change with the smallest possible scope and add or update tests when relevant.
- Before finishing, verify the change with the relevant project checks, especially `npm run check` and the relevant test suite.
- Keep pull requests focused and use the PR template provided in this repository.
