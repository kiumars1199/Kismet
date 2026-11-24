#!/bin/bash
# cold first byte of /m/<id>: fresh next start per run (empty in-memory caches), first request = /m
S=/tmp/claude-0/-home-user/1f04416e-5530-5507-9f54-ff1b97ced093/scratchpad
WT=$1; PORT=$2; N=$3; ID1=$(sed -n 1p $S/t114/ids.txt); ID2=$(sed -n 25p $S/t114/ids.txt)
for i in $(seq 1 $N); do
  pid=$($S/t114/srv.sh $S/$WT $PORT)
  for k in $(seq 1 600); do grep -q "Ready in" $S/t114/srv$PORT.log 2>/dev/null && break; sleep 0.2; done
  a=$(curl -s -o /dev/null -w "%{http_code} %{time_starttransfer}" "http://localhost:$PORT/m/$ID1")
  b=$(curl -s -o /dev/null -w "%{http_code} %{time_starttransfer}" "http://localhost:$PORT/m/$ID1")
  c=$(curl -s -o /dev/null -w "%{http_code} %{time_starttransfer}" "http://localhost:$PORT/m/$ID2")
  d=$(curl -s -o /dev/null -w "%{http_code} %{time_starttransfer}" "http://localhost:$PORT/m/999999999")
  echo "$WT run $i: cold /m/$ID1 [$a] | warm same [$b] | other id /m/$ID2 [$c] | unknown id [$d] | rss $(ps -o rss= -p $(pgrep -g $pid -f next-server | head -1) 2>/dev/null)KB"
  kill -TERM -$pid; for k in $(seq 1 100); do pgrep -g $pid >/dev/null || break; sleep 0.2; done
done
