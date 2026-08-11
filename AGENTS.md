# Repository workflow

## Mandatory issue → branch → pull request

Every repository change must use the following workflow, including changes to code,
tests, configuration, documentation, design assets, and agent instructions. A small
or urgent change is not an exception.

1. Create or identify a dedicated GitHub issue before editing files. Record the
   scope and acceptance criteria in the issue.
2. Start a new branch from an up-to-date `origin/main`. Use an issue-linked name,
   preferably `agent/issue-<number>-<short-description>`.
3. Make and commit the change on that branch. Never commit implementation work
   directly to `main` and never push directly to `main`.
4. Run the relevant checks and tests.
5. Push the branch and open a pull request that references the issue. Use
   `Closes #<number>` when merging the PR should close it.

Read-only investigation and answers that do not modify the repository do not need
an issue or branch. If work is accidentally started on `main`, create the issue and
move the changes to a fresh issue branch before pushing or opening a pull request.
