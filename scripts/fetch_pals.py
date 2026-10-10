"""Fetch Palworld pal data (ko) from paldb.cc.

Writes public/data/pals.json, public/data/spawns/<id>.json and public/icons/*.webp
Usage: python -I scripts/fetch_pals.py
Raw HTML/JSON is cached in .local/cache (shared with fetch_data.py).
"""
import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from html import unescape
from pathlib import Path
from urllib.parse import quote

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_data import BASE, CACHE, ICONS, ROOT, get, text  # noqa: E402

OUT = ROOT / "public" / "data"
SPAWNS = OUT / "spawns"
# landScapeRealPositionMin/Max from paldb map_data; the stitched map (z3) covers the whole 0..1 square
MIN_X, MIN_Y, MAX_X, MAX_Y = -1099400, -724400, 349400, 724400
MAP_PX = 4096


def to_text(html):
    t = re.sub(r"<script.*?</script>|<style.*?</style>", "", html, flags=re.S)
    t = re.sub(r"<[^>]+>", "|", t)
    return unescape(re.sub(r"\|[\s|]*\|", "|", t))


def icon_name(url):
    return url.rsplit("/", 1)[-1]


def parse_list(html):
    pals = {}
    for chunk in html.split('<div class="col" data-filters=')[1:]:
        pid = re.search(r'data-pal-id="([^"]+)"', chunk)
        href = re.search(r'href="([^"]+)"><img[^>]*src="([^"]+)"', chunk)
        no = re.search(r'text-white-50 small">([^<]+)<', chunk)
        name = re.search(r'class="itemname"[^>]*>([^<]+)</a>', chunk)
        if not (pid and href and name):
            continue
        head = chunk.split('<div class="my-1">')[0]
        elements = [
            {"icon": icon_name(u), "name": unescape(n)}
            for u, n in re.findall(r'src="([^"]+)"[^>]*data-bs-title="([^"]+)"', head)
        ]
        works = [
            {"icon": icon_name(u), "name": unescape(n), "lv": int(lv)}
            for n, u, lv in re.findall(
                r'data-bs-title="([^"]+)"><img[^>]*src="([^"]+)"[^>]*/>(\d+)</button>', chunk
            )
        ]
        pals[href.group(1)] = {
            "id": href.group(1),
            "code": pid.group(1),
            "no": no.group(1) if no else "",
            "name": unescape(name.group(1)),
            "icon": icon_name(href.group(2)),
            "iconUrl": href.group(2),
            "elements": elements,
            "works": works,
        }
    return pals


def parse_detail(html):
    t = to_text(html)
    info = {}
    # stats
    stats = {}
    seg = t[t.find("|Size|"):][:900]
    for k in ["Size", "HP", "공격", "방어", "작업 속도", "식사량", "Rarity"]:
        m = re.search(r"\|" + re.escape(k) + r"\|([^|]+)\|", "|" + seg)
        if m:
            stats[k] = m.group(1).strip()
    info["stats"] = stats
    m = re.search(r"\|Egg\|([^|]+)\|", t)
    info["egg"] = m.group(1).strip() if m else None
    # partner skill
    m = re.search(r"Partner Skill\|: ([^|]+)\|(.*?)(?:\|Lv\.\||\|Active Skills\|)", t, re.S)
    if m:
        desc = re.sub(r"\s+", " ", m.group(2).replace("|", "")).split("levelvalue")[0].strip()
        info["partner"] = {"name": m.group(1).strip(), "desc": re.sub(r"\.(?=[가-힣A-Za-z])", ". ", desc)}
    # normal drops (first table only)
    drops = []
    i = html.find('paldex_drop_item_title">Possible Drops')
    if i > 0:
        end = html.find("</table>", i)
        for href, q, p in re.findall(
            r'href="([^"]+)"><img[^>]*/>[^<]*</a>\s*<td><small class="itemQuantity">([^<]+)</small>.*?<td>\s*([\d.]+%)',
            html[i:end],
            re.S,
        ):
            drops.append({"id": href, "qty": unescape(q).replace("–", "~"), "prob": p})
    info["drops"] = drops
    # spawn zones
    zones = []
    i = html.find('text-info">Spawner<')
    if i > 0:
        end = html.find("</table>", i)
        for row in html[i:end].split("<tr>")[1:]:
            lv = re.search(r'class="level">([^<]+)<', row)
            code = re.search(r"Palpagos_Islands\?(?:zone|spawner)=([^\"]+)\"", row)
            if code:
                zones.append({"lv": unescape(lv.group(1)).replace("–", "~") if lv else "", "code": code.group(1)})
    info["zones"] = zones
    return info


def project(pt):
    """paldb real position -> pixel on the stitched 4096 map."""
    sx = (pt["X"] - MIN_X) / (MAX_X - MIN_X)
    sy = (pt["Y"] - MIN_Y) / (MAX_Y - MIN_Y)
    return sy * MAP_PX, (1 - sx) * MAP_PX


def spawn_points(code):
    try:
        raw = get(f"https://paldb.cc/paldex/{code.lower()}.json")
    except Exception:  # noqa: BLE001
        return None
    d = json.loads(raw)
    out = {}
    for key, tag in (("dayTimeLocations", "d"), ("nightTimeLocations", "n")):
        seen, pts = set(), []
        for loc in (d.get(key) or {}).get("Locations", []):
            x, y = project(loc)
            cell = (int(x // 10), int(y // 10))
            if 0 <= x < MAP_PX and 0 <= y < MAP_PX and cell not in seen:
                seen.add(cell)
                pts.append([round(x), round(y), loc.get("lv", 0)])
        out[tag] = pts
    return out


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    SPAWNS.mkdir(parents=True, exist_ok=True)
    pals = parse_list(get(BASE + "Pals"))
    print("pals on list:", len(pals))

    def work(p):
        try:
            p.update(parse_detail(get(BASE + quote(p["id"], safe="%/_()'-!,.:&"))))
            sp = spawn_points(p["code"])
            if sp and (sp["d"] or sp["n"]):
                (SPAWNS / f"{p['id']}.json").write_text(json.dumps(sp), encoding="utf8")
                p["hasSpawn"] = True
        except Exception as e:  # noqa: BLE001
            print("FAIL", p["id"], e, file=sys.stderr)
            p["failed"] = True

    with ThreadPoolExecutor(4) as ex:
        list(ex.map(work, pals.values()))

    res = [p for p in pals.values() if not p.get("failed")]
    icons = {}
    for p in res:
        icons[p["icon"]] = p.pop("iconUrl")
        for e in p["elements"]:
            icons.setdefault(e["icon"], f"https://cdn.paldb.cc/image/Pal/Texture/UI/InGame/{e['icon']}")
        for w in p["works"]:
            icons.setdefault(w["icon"], f"https://cdn.paldb.cc/image/Pal/Texture/UI/InGame/{w['icon']}")

    def dl(kv):
        name, url = kv
        p = ICONS / name
        if not p.exists():
            try:
                p.write_bytes(get(url, binary=True))
            except Exception as e:  # noqa: BLE001
                print("ICON FAIL", url, e, file=sys.stderr)

    with ThreadPoolExecutor(6) as ex:
        list(ex.map(dl, icons.items()))
    (OUT / "pals.json").write_text(json.dumps(res, ensure_ascii=False), encoding="utf8")
    print("saved", len(res), "pals,", len(icons), "icons")


if __name__ == "__main__":
    main()
