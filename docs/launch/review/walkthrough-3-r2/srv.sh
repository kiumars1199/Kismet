#!/bin/bash
S=/tmp/claude-0/-home-user/1f04416e-5530-5507-9f54-ff1b97ced093/scratchpad
cd $S/wt3/apps/web && . $S/wt3r2/env.sh && exec pnpm exec next start -p 3741
