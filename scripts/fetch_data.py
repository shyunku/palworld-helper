"""Fetch Palworld item data (ko) from paldb.cc and write public/data/items.json + public/icons/*.webp.

Usage: python scripts/fetch_data.py
Raw HTML is cached in .local/cache so re-runs are cheap.
"""
import hashlib
import json
import re
import sys
import time
import urllib.request
from urllib.parse import quote
from concurrent.futures import ThreadPoolExecutor
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".local" / "cache"
OUT = ROOT / "public" / "data"
ICONS = ROOT / "public" / "icons"
BASE = "https://paldb.cc/ko/"
UA = "Mozilla/5.0 (palworld-helper personal project)"


def get(url, binary=False):
    key = hashlib.sha1(url.encode()).hexdigest()
    f = CACHE / key
    if f.exists():
        data = f.read_bytes()
    else:
        for attempt in range(4):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": UA})
                data = urllib.request.urlopen(req, timeout=30).read()
                break
            except Exception as e:  # noqa: BLE001
                if attempt == 3:
                    raise
                time.sleep(2 * (attempt + 1))
        f.write_bytes(data)
        time.sleep(0.15)
    return data if binary else data.decode("utf8")


def text(s):
    return unescape(re.sub(r"<[^>]+>", "", s)).strip()


PLACEHOLDER = "ko_Text"  # untranslated entries in the Korean data


def fix_names(entries):
    """Entries whose Korean name is the untranslated placeholder get a manual override or the English page title."""
    overrides = json.loads((ROOT / "scripts" / "name_overrides.json").read_text(encoding="utf8"))
    for e in entries:
        if e["id"] in overrides:
            e["name"] = overrides[e["id"]]
        elif e["name"] == PLACEHOLDER:
            try:
                html = get("https://paldb.cc/en/" + quote(e["id"], safe="%/_()'-!,.:&"))
                m = re.search(r"<title>(.*?) - Palworld", html)
                e["name"] = (unescape(m.group(1)).strip() if m else e["id"]).replace("_", " ")
            except Exception:  # noqa: BLE001
                e["name"] = e["id"].replace("_", " ")
        if e.get("desc") == PLACEHOLDER:
            e["desc"] = ""


def parse_list(html):
    """Unique item pages from the list page, keeping the first (lowest-rarity) variant."""
    items = {}
    for chunk in html.split('<div class="col"><div class="d-flex border rounded">')[1:]:
        m = re.search(r'href="([^"]+)"><img[^>]*src="([^"]+)"', chunk)
        n = re.search(r'<a class="itemname"[^>]*href="([^"]+)"[^>]*>([^<]*)</a>(?:<div>(.*))?', chunk, re.S)
        if not m or not n:
            continue
        href, icon = m.groups()
        if href in items:
            continue
        desc = re.sub(r'<div class="item_skill_bar.*', "", n.group(3) or "", flags=re.S)
        items[href] = {
            "id": href,
            "name": unescape(n.group(2)),
            "icon": icon,
            "desc": text(desc),
        }
    return items


def parse_detail(html):
    kv = {}
    for k, v in re.findall(r"<div>([A-Za-z]+)</div>\s*<div>([^<]*)</div>", html):
        kv.setdefault(k, v.strip())
    info = {
        "typeA": kv.get("TypeA"),
        "typeB": kv.get("TypeB"),
        "rarity": int(kv["Rarity"]) if kv.get("Rarity", "").isdigit() else 0,
        "legal": kv.get("bLegalInGame", "1") != "0",
    }
    m = re.search(r'<a href="[^"]+">([^<]+)</a></div>\s*</div>\s*<div class="d-flex[^>]*>\s*<div>Rank', html)
    info["typeAKo"] = m.group(1) if m else None

    sec = html.find("convert_item_product_tab_title")
    if sec < 0:
        return info
    end = html.find("</tbody>", sec)
    block = html[sec:end]
    benches = re.findall(r'<a class="itemname " [^>]*>(?:<img[^>]*/>)?([^<]+)</a>', block.split("<table")[0])
    for row in block.split("<tr>")[1:]:
        tds = row.split("<td>")
        if len(tds) < 3:
            continue
        mats = [
            {"id": h, "qty": int(q)}
            for h, q in re.findall(r'href="([^"]+)"><img[^>]*/>[^<]*</a> <small class="itemQuantity">(\d+)</small>', tds[1])
        ]
        info["recipe"] = mats
        info["bench"] = [unescape(b) for b in benches]
        break
    return info


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    ICONS.mkdir(parents=True, exist_ok=True)

    items = parse_list(get(BASE + "Items"))
    print("items on list:", len(items))

    def work(it):
        try:
            it.update(parse_detail(get(BASE + quote(it["id"], safe="%/_()'-!,.:&"))))
        except Exception as e:  # noqa: BLE001
            print("FAIL", it["id"], e, file=sys.stderr)
            it["failed"] = True

    with ThreadPoolExecutor(4) as ex:
        list(ex.map(work, items.values()))

    # keep only legal, non-failed items; materials must exist
    res = {k: v for k, v in items.items() if v.get("legal", True) and not v.get("failed")}
    for v in res.values():
        if "recipe" in v:
            v["recipe"] = [m for m in v["recipe"] if m["id"] in res]
            if not v["recipe"]:
                del v["recipe"]
        v.pop("legal", None)

    fix_names(res.values())

    # icons
    urls = sorted({v["icon"] for v in res.values()})

    def dl(u):
        name = u.rsplit("/", 1)[-1]
        p = ICONS / name
        if not p.exists():
            try:
                p.write_bytes(get(u, binary=True))
            except Exception as e:  # noqa: BLE001
                print("ICON FAIL", u, e, file=sys.stderr)

    with ThreadPoolExecutor(6) as ex:
        list(ex.map(dl, urls))
    for v in res.values():
        v["icon"] = v["icon"].rsplit("/", 1)[-1]

    (OUT / "items.json").write_text(json.dumps(list(res.values()), ensure_ascii=False, indent=0), encoding="utf8")
    print("saved", len(res), "items,", len(urls), "icons")


if __name__ == "__main__":
    main()
