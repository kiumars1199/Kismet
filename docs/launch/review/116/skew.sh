#!/bin/bash
# warm instance, then a NORMAL new scan lands (counts.json + teasers.json + top.json all rewritten with the same newer scanned_at)
S=/tmp/claude-0/-home-user/1f04416e-5530-5507-9f54-ff1b97ced093/scratchpad; cd $S/t116b; WT=$1; P=3755
cp counts.orig data/counts.json; cp teasers.orig data/teasers.json; cp top.orig data/top.json
pid=$(./srv.sh $S/$WT $P); for k in $(seq 1 600); do grep -q "Ready in" srv$P.log 2>/dev/null && break; sleep 0.2; done
t() { curl -s -o /dev/null -w "%{http_code} %{time_starttransfer}" "http://localhost:$P/m/$(sed -n ${1}p ids.txt)"; }
echo "$WT t=0 cold /m: [$(t 1)]  warm: [$(t 2)]"
if [ -z "$NOSCAN" ]; then python3 - <<'PY'
import json
for f,key in (("counts.json",None),("teasers.json","meta"),("top.json","meta")):
    p="data/"+f; d=json.load(open(p))
    if key: d[key]["scanned_at"]+=600
    else: d["scanned_at"]+=600; d["meta"]["scanned_at"]+=600
    json.dump(d,open(p+".tmp","w"),separators=(",",":"))
    import os; os.replace(p+".tmp",p)
PY
fi
echo "$WT ${NOSCAN:+NO }new scan written"
sleep 35; echo "$WT t=35s /m other id: [$(t 3)]  next: [$(t 4)]"
sleep 30; echo "$WT t=65s /m other id: [$(t 5)]  next: [$(t 6)]"
grep -i "teaser\|store\|warn" srv$P.log | tail -5
kill -TERM -$pid; for k in $(seq 1 100); do pgrep -g $pid >/dev/null || break; sleep 0.2; done
cp counts.orig data/counts.json; cp teasers.orig data/teasers.json; cp top.orig data/top.json
