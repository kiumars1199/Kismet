import json, os, shutil, time, tempfile
from engine import venues as v
class Cfg:
    def __init__(s, r): s.r = r
    def path(s, *p): return os.path.join(s.r, *p)
d = tempfile.mkdtemp(dir="/tmp/claude-0/-home-user/1f04416e-5530-5507-9f54-ff1b97ced093/scratchpad/r102"); os.makedirs(d + "/output")
shutil.copy("/home/user/MarketEdge/output/markets.json", d + "/output/markets.json")
shutil.copy("/tmp/claude-0/-home-user-MarketEdge/1f04416e-5530-5507-9f54-ff1b97ced093/scratchpad/bigdata/kalshi_index.json", d + "/output/kalshi_index.json")
logs = []
# 1) real markets.json (13.9K) x 207K synthetic Kalshi rows, normal budget
t = time.time(); r = v.write(Cfg(d), log=logs.append); print(f"write: {time.time()-t:.1f}s, {len(r)} entries;", logs[-1])
good = open(d + "/output/venues.json").read()
# 2) budget expiring in the MATCHING loop (after indexing): fake clock jumps once indexing is done
real = time.monotonic; state = {"calls": 0}
orig_init = v.KalshiIndex.__init__
def init(self, rows, deadline=None):
    orig_init(self, rows, deadline); state["after"] = True
v.KalshiIndex.__init__ = init
def mono():
    if state.get("after"):
        state["calls"] += 1
        if state["calls"] > 30: return real() + 10_000
    return real()
v.time.monotonic = mono
logs.clear(); r2 = v.write(Cfg(d), log=logs.append)
print("mid-match bail: logs", logs, "| file unchanged:", open(d + "/output/venues.json").read() == good, "| no tmp left:", not os.path.exists(d + "/output/venues.json.tmp"), "| returned prev:", r2 == json.loads(good)["venues"])
v.time.monotonic = real; v.KalshiIndex.__init__ = orig_init
# 3) budget hit with no previous venues.json
os.remove(d + "/output/venues.json"); logs.clear(); r3 = v.write(Cfg(d), log=logs.append, budget_s=0)
print("no previous file:", logs, r3, "exists after:", os.path.exists(d + "/output/venues.json"))
shutil.rmtree(d)
