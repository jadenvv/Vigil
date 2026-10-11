#!/bin/bash
# Vigil — one-command verification. Runs every check we have and reports PASS/FAIL.
# Continues past failures, then exits non-zero if any step failed.
#
#   ./verify.sh
set -u

cd "$(dirname "$0")"

if command -v python3.12 >/dev/null 2>&1; then PY=python3.12; else PY=python3; fi

FAILED=()
run() {
  local name="$1"; shift
  echo "== $name"
  if "$@"; then
    echo "-- ok"
  else
    FAILED+=("$name")
    echo "-- FAILED: $name"
  fi
  echo
}

run "crawl tests (pytest)"          "$PY" -m pytest -q crawl/tests
run "engine tests (unittest)"       "$PY" -m unittest engine.test_engine
run "engine JS parity"              node engine/port/parity.mjs
for f in net-guard discover page-text page-html recheck; do
  run "deno self-check: $f"         deno run "base44/app/base44/shared/$f.ts"
done
run "deno self-check: calc-check"   deno run --allow-run --allow-env=DAYTONA_API_KEY base44/app/base44/shared/calc-check.ts
run "deno self-check: clerk-auth"   deno run base44/app/base44/shared/clerk-auth.ts
# --allow-read only: the self-check asserts the ReviewerDecision entity RLS stays all-false.
run "deno self-check: reviewer-core" deno run --allow-read=base44/app/base44/entities base44/app/base44/shared/reviewer-core.ts
run "app tests (vitest)"            bash -c 'cd base44/app && npm test'
run "app build (vite)"              bash -c 'cd base44/app && npm run build'

echo "=================================================="
if ((${#FAILED[@]})); then
  echo "FAIL — ${#FAILED[@]} step(s) failed:"
  for f in "${FAILED[@]}"; do echo "  - $f"; done
  exit 1
fi
echo "PASS — all checks passed"
