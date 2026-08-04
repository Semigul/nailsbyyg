# GitHub workflow setup guide for NailsbyYG

## 1. Create labels

Create these labels in GitHub:

- `needs-refinement`
- `ready-for-dev`
- `in-development`
- `ready-for-review`
- `needs-changes`
- `ready-for-staging`
- `approved`
- `blocked`

Suggested colors:
- `needs-refinement`: blue
- `ready-for-dev`: green
- `in-development`: yellow
- `ready-for-review`: purple
- `needs-changes`: red
- `ready-for-staging`: orange
- `approved`: bright green
- `blocked`: gray

## 2. Create a GitHub Project board

Create a project with these columns:

1. Backlog
2. Refinement
3. Ready for development
4. In progress
5. Review
6. Ready for staging
7. Done

Use the issue status to move items between columns.

## 3. Protect the main branch

Enable branch protection for `main` with:

- require pull request before merging
- require approvals: 1
- dismiss stale pull request approvals when new commits are pushed
- require conversation resolution before merging
- require status checks to pass before merging
- select the CI workflow as a required check

## 4. Recommended workflow for a new issue

1. Create an issue and add it to the project.
2. Add the `needs-refinement` label.
3. Add a short problem statement, success criteria, and constraints.
4. When refined, change to `ready-for-dev`.
5. Open a draft PR and link it to the issue.
6. When implementation is ready, add `ready-for-review`.
7. After review, add `ready-for-staging`.
8. A human maintainer approves and merges.

## 5. When to release to staging

- Use staging for integration testing and validation.
- Release to staging after the PR has passed CI and received human approval.
- Do not release directly to production from every PR.

## 6. Cost-saving rules

- Only run the full review agent for meaningful changes.
- Use draft PRs to keep work visible without triggering extra overhead.
- Keep PRs focused and small.
- Skip heavy automation for docs-only or trivial updates.
