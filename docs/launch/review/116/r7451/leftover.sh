#!/bin/bash
# warm instance, then a TRUE leftover: only counts.json moves to a newer scan (teasers/top precompute failed)
S=/tmp/claude-0/-home-user/1f04416e-5530-5507-9f54-ff1b97ced093/scratchpad; cd $S/t116; WT=$1; P=3755
cp counts.orig data/counts.json; cp teasers.orig data/teasers.json; cp top.orig data/top.json
pid=$(./srv.sh $S/$WT $P); for k in $(seq 1 600); do grep -q "Ready in" srv$P.log 2>/dev/null && break; sleep 0.2; done
t() { curl -s -o /dev/null -w "%{time_starttransfer}" "http://localhost:$P/m/$(sed -n ${1}p ids.txt)"; }
echo "$WT t=0 cold /m: $(t 1) warm: $(t 2)"
python3 -c "
import json,os; p='data/counts.json'; d=json.load(open(p)); d['scanned_at']+=600; d['meta']['scanned_at']+=600
json.dump(d,open(p+'.tmp','w')); os.replace(p+'.tmp',p)"
echo "$WT leftover: counts.json only"
sleep 35; echo "$WT t=35s /m x8: $(for i in 3 4 5 6 7 8 9 10; do printf '%s ' $(t $i); done)"
NS=$(for q in /proc/[0-9]*; do [ "$(readlink $q/cwd)" = "$S/$WT/apps/web" ] && grep -q next-server $q/cmdline 2>/dev/null && basename $q; done | head -1); strace -f -e trace=openat -o leftover-strace-$WT.txt -p $NS & sp=$!; sleep 1
for i in 11 12 13 14 15; do t $i >/dev/null; done; for i in $(seq 1 15); do t 11 >/dev/null; done; sleep 1; kill $sp 2>/dev/null; sleep 1
echo "$WT teasers.json opens during 20 /m requests (within one 60 s window): $(grep -c 'teasers.json' leftover-strace-$WT.txt 2>/dev/null)"
kill -TERM -$pid; for k in $(seq 1 100); do pgrep -g $pid >/dev/null || break; sleep 0.2; done
cp counts.orig data/counts.json
