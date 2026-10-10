"""Fetch map markers (fast travel, towers, alpha pals, dungeons) from paldb.cc map data (ko).

Writes public/data/markers.json (map pixel coordinates on the stitched 4096px map) and the marker icons.
Usage: python -I scripts/fetch_markers.py
"""
import json
import re
import sys
from html import unescape
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_data import ICONS, ROOT, get  # noqa: E402

OUT = ROOT / "public" / "data"
MIN_X, MIN_Y, MAX_X, MAX_Y = -1099400, -724400, 349400, 724400
MAP_PX = 4096

# paldb marker type -> our layer key
LAYERS = {"Fast Travel": "fast", "Tower": "tower", "Alpha Pal": "alpha", "Dungeon": "dungeon"}


def grab(src, name):
    i = src.index("var " + name)
    i = src.index("=", i) + 1
    value, _ = json.JSONDecoder().raw_decode(src[i:].lstrip())
    return value


def project(p):
    sx = (p["X"] - MIN_X) / (MAX_X - MIN_X)
    sy = (p["Y"] - MIN_Y) / (MAX_Y - MIN_Y)
    return round(sy * MAP_PX), round((1 - sx) * MAP_PX)


def plain(html):
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", "", html))).strip()


def main():
    src = get("https://paldb.cc/js/map_data_ko.js")
    entries = grab(src, "fixedDungeon")
    lookup = grab(src, "iconLookup")
    out = {k: [] for k in LAYERS.values()}
    icons = {}  # file name -> url
    for e in entries:
        layer = LAYERS.get(e.get("type"))
        pos = e.get("pos")
        if not layer or not pos:
            continue
        if not (MIN_X < pos["X"] < MAX_X and MIN_Y < pos["Y"] < MAX_Y):
            continue
        x, y = project(pos)
        m = {"x": x, "y": y, "n": plain(e.get("item", ""))}
        if e.get("lv"):
            m["lv"] = int(e["lv"])
        if e.get("comment"):
            m["c"] = plain(e["comment"])
        if layer == "alpha" and e.get("fixed_icon"):
            m["i"] = e["fixed_icon"].rsplit("/", 1)[-1]
            icons[m["i"]] = e["fixed_icon"]
        out[layer].append(m)

    layer_icons = {}
    for t, layer in LAYERS.items():
        url = lookup[t]["fixed_icon"]
        name = url.rsplit("/", 1)[-1]
        layer_icons[layer] = name
        icons[name] = url
    for name, url in icons.items():
        p = ICONS / name
        if not p.exists():
            try:
                p.write_bytes(get(url, binary=True))
            except Exception as ex:  # noqa: BLE001
                print("ICON FAIL", url, ex, file=sys.stderr)

    (OUT / "markers.json").write_text(json.dumps({"icons": layer_icons, **out}, ensure_ascii=False), encoding="utf8")
    print({k: len(v) for k, v in out.items()}, layer_icons)


if __name__ == "__main__":
    main()
