S=/tmp/claude-0/-home-user/1f04416e-5530-5507-9f54-ff1b97ced093/scratchpad
killmine(){ cd $S; for p in /proc/[0-9]*; do pid=${p#/proc/}; [ "$pid" = "$$" ] && continue; c=$(readlink $p/cwd 2>/dev/null) || continue; case "$c" in $S/rv2-*) kill $pid 2>/dev/null;; esac; done; sleep 2; }
for r in 1 2 3; do for P in "/m/6596313?ref=abcd1234" "/signup?next=%2Fm%2F6596313" "/state?next=%2Fm%2F6596313"; do
  killmine; (cd $S/rv2-w1/apps/web && . $S/t119/w1env.sh && nohup pnpm exec next start -p 3755 >> $S/t119/w1-cold.log 2>&1 &)
  for i in $(seq 60); do curl -s -o /dev/null http://localhost:3755/robots.txt && break; sleep 0.5; done
  echo -n "round $r cold-first "; cd $S; P="$P" WT=$S/rv2-w1 node $S/probe/w1one.mjs 2>&1 | tail -1
done; done; killmine
