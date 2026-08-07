# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- Create an issue with `gh issue create`.
- Read issues and comments with `gh issue view`.
- List and filter issues with `gh issue list`.
- Comment with `gh issue comment`.
- Apply or remove labels with `gh issue edit`.
- Close issues with `gh issue close`.

Infer the repository from `git remote -v`.

## Pull requests as a triage surface

PRs as a request surface: no.

## Publishing work

When a skill says “publish to the issue tracker”, create a GitHub issue.

When a skill says “fetch the relevant ticket”, read the corresponding GitHub issue and its comments.

## Wayfinding operations

The `$wayfinder` map is a GitHub issue labelled `wayfinder:map`.

- Decision tickets are child issues carrying one of:
  - `wayfinder:research`
  - `wayfinder:prototype`
  - `wayfinder:grilling`
  - `wayfinder:task`
- Prefer GitHub sub-issues; otherwise link tickets through the map body.
- Prefer native GitHub issue dependencies; otherwise use `Blocked by:` in the ticket body.
- An unblocked, unassigned child issue belongs to the frontier.
- Claim a ticket by assigning it to the current developer.
- Resolve it with a resolution comment, close it, then append its result to the map’s “Decisions so far”.
