#!/usr/bin/env bash
set -euo pipefail

echo "Running release preflight checks..."

required_files=(
  "index.html"
  "styles.css"
  "app.js"
  ".github/workflows/deploy-pages.yml"
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

echo "PASS: Preflight checks completed."
