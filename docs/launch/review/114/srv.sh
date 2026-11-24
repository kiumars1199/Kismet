#!/bin/bash
# usage: srv.sh WT PORT  -> next start (production build), real-size data, signed-out capable, local mocks
cd $1/apps/web || exit 1
O=http://localhost:$2
export DATA_DIR=/tmp/claude-0/-home-user/1f04416e-5530-5507-9f54-ff1b97ced093/scratchpad/t114/data DATA_SOURCE=local DATA_CLOCK=scan HISTORY_LIVE=off DEMO_MODE=false NEXT_PUBLIC_DEMO_MODE=false E2E_MOCK=1 \
 NEXT_PUBLIC_SITE_URL=$O KALSHI_DATA_PERMISSION=true NEXT_PUBLIC_SUPABASE_URL=$O/e2e-mock/supabase NEXT_PUBLIC_SUPABASE_ANON_KEY=e2e-anon \
 SUPABASE_SERVICE_ROLE_KEY=e2e-service STRIPE_SECRET_KEY=sk_test_e2e STRIPE_WEBHOOK_SECRET=whsec_e2e STRIPE_API_BASE=$O
setsid nohup pnpm exec next start -p $2 > /tmp/claude-0/-home-user/1f04416e-5530-5507-9f54-ff1b97ced093/scratchpad/t114/srv$2.log 2>&1 < /dev/null &
echo $!
