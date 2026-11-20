#!/bin/bash
export PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user-MarketEdge/2e8d356b-d1b5-5401-91e6-9f451833b42c/scratchpad/pw
S=/tmp/claude-0/-home-user-MarketEdge/2e8d356b-d1b5-5401-91e6-9f451833b42c/scratchpad
L=$S/logs3; mkdir -p $L
cd $S/clean4
run(){ name=$1; shift; echo "=== $name: $*" ; ( "$@" ) > $L/$name.log 2>&1; echo "=== $name exit $?" ; }
python3 -m venv $S/venv3 >/dev/null 2>&1
. $S/venv3/bin/activate
run pip pip install -q -r requirements.txt
run pytest pytest -q
cd apps/web
run pnpm_i pnpm i --frozen-lockfile
run typecheck pnpm typecheck
run lint pnpm lint
run unit pnpm test
cd ../extension
run ext_i pnpm i --frozen-lockfile
run ext_tc pnpm typecheck
run ext_test pnpm test
cd ../web
export PW_PORT=3160
run e2e_demo pnpm exec playwright test --reporter=list
run e2e_paid pnpm exec playwright test -c playwright.paid.config.ts --reporter=list
