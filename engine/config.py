import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


class Config(dict):
    __getattr__ = dict.get

    def path(self, kind, name):
        d = os.path.join(ROOT, self[f"{kind}_dir"])
        os.makedirs(d, exist_ok=True)
        return os.path.join(d, name)


def load(path):
    with open(os.path.join(ROOT, path) if not os.path.isabs(path) else path) as f:
        return Config(json.load(f))
