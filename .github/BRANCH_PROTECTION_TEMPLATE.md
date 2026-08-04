# Branch protection template for main

Use the following settings in GitHub for the `main` branch:

- Require a pull request before merging
- Require approvals: 1
- Dismiss stale pull request approvals when new commits are pushed
- Require review from Code Owners
- Require conversation resolution before merging
- Require status checks to pass before merging
- Required status checks:
  - CI / Quality checks and tests
- Restrict who can push directly to the branch

This protects the main branch while still allowing a lightweight collaborative workflow.
