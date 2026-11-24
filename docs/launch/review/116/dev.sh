#!/bin/bash
# usage: rv2-server.sh <worktree> ; starts paid-mode (E2E mock) dev server on 3755
cd $1/apps/web
O=http://localhost:3755
export DATA_DIR=/tmp/claude-0/-home-user/1f04416e-5530-5507-9f54-ff1b97ced093/scratchpad/t116/data DATA_SOURCE=local DATA_CLOCK=scan DEMO_MODE=false NEXT_PUBLIC_DEMO_MODE=false E2E_MOCK=1 \
 NEXT_PUBLIC_SITE_URL=$O ADMIN_EMAILS=admin-e2e@example.com KALSHI_DATA_PERMISSION=true \
 NEXT_PUBLIC_SUPABASE_URL=$O/e2e-mock/supabase NEXT_PUBLIC_SUPABASE_ANON_KEY=e2e-anon SUPABASE_SERVICE_ROLE_KEY=e2e-service \
 STRIPE_SECRET_KEY=sk_test_e2e STRIPE_WEBHOOK_SECRET=whsec_e2e STRIPE_API_BASE=$O \
 STRIPE_PRICE_PRO_MONTHLY=price_pro_m STRIPE_PRICE_PRO_YEARLY=price_pro_y STRIPE_PRICE_PREMIUM_MONTHLY=price_premium_m STRIPE_PRICE_PREMIUM_YEARLY=price_premium_y \
 NODE_OPTIONS=--max-old-space-size=3072
export NEXT_PUBLIC_GOOGLE_AUTH=${GOOGLE:-}
exec pnpm exec next dev -p 3755
