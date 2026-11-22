"""Nov 22: JSON outputs are written whole or not at all. A full Railway volume once left a truncated model.json (the
plain `json.dump(x, open(p, "w"))` swallowed the write error at garbage collection), and every scan then failed to read
it for 4 hours. Write to a temp file, close it (which raises on a full disk), then rename over the old file."""
import json
import os


def dump_atomic(path, obj, **kw):
    tmp = f"{path}.tmp"
    try:
        with open(tmp, "w") as f:
            json.dump(obj, f, **kw)
        os.replace(tmp, path)
    except BaseException:
        try:
            os.remove(tmp)
        except OSError:
            pass
        raise
