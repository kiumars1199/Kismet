# usage: og.sh <port> <outdir>
B=http://localhost:$1; O=$2
sig() { node -e 'const c=require("crypto");const k=c.createHash("sha256").update("me:share:v1:rv-f13-secret").digest();process.stdout.write(c.createHmac("sha256",k).update(process.argv[1]+"|"+process.argv[2]).digest("base64url").slice(0,22))' "$1" "$2"; }
for row in "FLAG 6674492 0" "FLAGOTHER 6674492 1" "POSNOTFLAG 6771258 1" "NEG 7101594 1"; do set -- $row; n=$1; id=$2; s=$3; g=$(sig $id $s)
  curl -s -o $O/og-$n.png -w "%{http_code} %{size_download}" "$B/api/og/bet/$id?s=$s&sig=$g" > /tmp/claude-0/-home-user/1f04416e-5530-5507-9f54-ff1b97ced093/scratchpad/c1; a=$(cat /tmp/claude-0/-home-user/1f04416e-5530-5507-9f54-ff1b97ced093/scratchpad/c1)
  b=$(curl -s -o $O/og-$n-nosig.png -w "%{size_download}" "$B/api/og/bet/$id")
  d=$(curl -s "$B/m/$id?s=$s&sig=$g" | grep -o '<meta property="og:description" content="[^"]*"')
  i=$(curl -s "$B/m/$id?s=$s&sig=$g" | grep -o '<meta property="og:image" content="[^"]*"' | head -1)
  echo "$n $id side=$s og=$a nosig=${b}B | $d | $i"
done
for id in 6674492 6771258 7101594; do echo "link $id: $(curl -s "$B/api/share/link?m=$id")"; done
