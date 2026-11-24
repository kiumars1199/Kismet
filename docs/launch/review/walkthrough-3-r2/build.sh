#!/bin/bash
S=/tmp/claude-0/-home-user/1f04416e-5530-5507-9f54-ff1b97ced093/scratchpad
cd $S/wt3/apps/web && pnpm i --frozen-lockfile >/dev/null 2>&1 && node e2e-paid/make-fixtures.mjs && node $S/wt3r/shift.mjs test-results/paid-fixtures && . $S/wt3r2/env.sh && pnpm exec next build
