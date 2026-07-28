---
name: Release To GitHub Pages
description: "Run a full release readiness check and deploy workflow review for GitHub Pages."
agent: "GH Pages Release"
argument-hint: "Example: release from main and verify workflow"
---
Prepare this project for GitHub Pages release.

Tasks:
1. Validate release requirements.
2. Check deploy workflow and repository assumptions.
3. Suggest or apply minimal fixes.
4. Return a final release checklist with Ready or Blocked.
