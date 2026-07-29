#!/usr/bin/env bash
set -euo pipefail

echo "Running release preflight checks..."

required_files=(
  "index.html"
  "styles.css"
  "app.js"
  "package.json"
  "package-lock.json"
  "playwright.config.js"
  "tests/e2e/customer-order.spec.js"
  "tests/e2e/admin-orders.spec.js"
  ".githooks/pre-push"
  ".github/dependabot.yml"
  ".github/workflows/deploy-pages.yml"
  "scripts/check-firebase-version.mjs"
  "README.md"
)

for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "FAIL: Missing required file: $file"
    exit 1
  fi
done

if [[ -f "firebase.config.js" ]]; then
  echo "WARN: firebase.config.js exists locally. Ensure it is not committed."
fi

if [[ ! -d "node_modules/@playwright/test" ]]; then
  echo "FAIL: E2E dependencies are missing. Run npm install."
  exit 1
fi

npm run security
npm test

echo "PASS: Preflight checks completed."
