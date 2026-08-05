# NailsbyYG development workflow

This document describes the recommended end-to-end workflow for ideas, refinement, implementation, review, testing, staging, and release.

## Goals

- Keep collaboration simple and predictable
- Use GitHub Projects, issues, pull requests, and labels as the single source of truth
- Keep the process efficient and cost-conscious
- Make staging the main pre-production validation environment
- Keep production releases manual and deliberate

## Roles

- Product owner / lead: defines priorities, approves scope, and makes final release decisions
- Developer: implements the work and keeps the PR focused
- Reviewer: checks correctness, maintainability, security, and test coverage
- GitHub/automation maintainer: keeps labels, workflows, and branch protection healthy

## Lifecycle overview

1. Idea enters the backlog
2. Refinement clarifies the work
3. Development starts from a draft PR
4. Review and testing verify the change
5. Staging validates the release candidate
6. Production release is approved manually

## Step-by-step flow

### 1. Idea creation

- A new idea, bug, or feature request is created as a GitHub issue
- The issue is added to the GitHub Project board
- The issue gets a basic title and short description

### 2. Refinement

- The issue is labeled `needs-refinement`
- The refinement step produces:
  - problem statement
  - acceptance criteria
  - proposed scope
  - implementation notes and risks
- When refinement is complete, the label changes to `ready-for-dev`

### 3. Development

- Adding the `ready-for-dev` label automatically creates a draft PR linked to the issue and starts the implementation agent
- The issue moves to the `In progress` column
- The PR stays focused on one change or one feature
- The developer updates the PR as work progresses
- The issue is labeled `in-development`

### 4. Review

- When implementation is ready, the label changes to `ready-for-review`
- A reviewer checks:
  - correctness
  - security
  - performance
  - readability and maintainability
  - test coverage
- If changes are needed, the PR is labeled `needs-changes`
- Once the review passes, the PR is ready for staging

### 5. Testing

- CI runs automatically for pull requests
- Required checks include:
  - `CI / Quality checks and tests`
- If new behavior is introduced, relevant tests should be added or updated
- For smaller changes, only the relevant subset of tests should run

### 6. Staging

- When the change is approved for validation, the label changes to `ready-for-staging`
- The change is merged to the staging branch or otherwise promoted to the staging environment
- The staging environment is used for final validation before production release
- A human maintainer confirms that the change is safe to release

### 7. Production release

- Production release is manual and deliberate
- Only approved, tested changes are promoted to production
- The release decision is made by the product owner or lead maintainer

## Decision points

### When to create a PR

- Add the `ready-for-dev` label as soon as implementation should begin so automation creates the draft PR immediately
- Do not wait until the work is complete

### When to release to staging

- Release to staging after CI passes and the change is reviewed
- Use staging for final validation and regression checks

### When to release to production

- Release to production only after staging validation and human approval

## Recommended labels

- `needs-refinement`
- `ready-for-dev`
- `in-development`
- `ready-for-review`
- `needs-changes`
- `ready-for-staging`
- `approved`
- `blocked`

## Recommended board columns

- Backlog
- Refinement
- Ready for development
- In progress
- Review
- Ready for staging
- Done

## Suggested ownership

- Issue creator: writes the initial problem description
- Refinement owner: turns the issue into an actionable plan
- Developer: implements the plan
- Reviewer: validates the implementation
- Maintainer: approves the release

## Cost-saving rules

- Run the heavy review workflow only for meaningful changes
- Keep pull requests small and focused
- Use draft PRs for in-progress work
- Skip full automation for docs-only or trivial work
