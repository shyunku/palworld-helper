"""Fetch Palworld structure (building) data (ko) from paldb.cc.

Writes public/data/structs.json and public/icons/*.webp
Technology points come from the Technologies page (BossTechnology rows = ancient technology).
Usage: python -I scripts/fetch_structs.py
"""
import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from html import unescape
from pathlib import Path
from urllib.parse import quote

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_data import BASE, CACHE, ICONS, ROOT, fix_names, get, text  # noqa: E402

OUT = ROOT / "public" / "data"


def parse_list(html):
    res = {}
    for chunk in html.split('<div class="col"><div class="d-flex border rounded">')[1:]:
        m = re.search(r'href="([^"]+)"><img[^>]*src="([^"]+)"', chunk)
        n = re.search(r'<a class="itemname"[^>]*href="([^"]+)"[^>]*>([^<]*)</a>(?:<div>(.*))?', chunk, re.S)
        if not m or not n or m.group(1) in res:
            continue
        res[m.group(1)] = {
            "id": m.group(1),
            "name": unescape(n.group(2)),
            "iconUrl": m.group(2),
            "desc": text(n.group(3) or ""),
        }
    return res


def parse_detail(html):
    info = {}
    m = re.search(r"<div>Type</div>\s*<div><a href=\"[^\"]+\">([^<]+)</a>", html)
    info["cat"] = unescape(m.group(1)) if m else "기타"
    # game sub category (TypeB), e.g. Prod_Craft / Prod_Furnace; used to split the big folders
    kv = {}
    for k, v in re.findall(r"<div>([A-Za-z]+)</div>\s*<div>([^<]*)</div>", html):
        kv.setdefault(k, v.strip())
    info["typeB"] = kv.get("TypeB")
    m = re.search(r">기술</span></span><span class=\"border p-1\">(\d+)<", html)
    info["techLv"] = int(m.group(1)) if m else None
    m = re.search(r">SAN</span><span class=\"border p-1\">([^<]+)<", html)
    info["san"] = m.group(1) if m else None
    i = html.find("RequiredSuitability")
    if i > 0:
        blk = html[i : html.find('class="recipes"', i)]
        info["works"] = [
            {"icon": u.rsplit("/", 1)[-1], "lv": int(lv)}
            for u, lv in re.findall(r'src="([^"]+)"[^>]*/></a>\s*<div class="bottom-right-text">(\d+)<', blk)
        ]
    i = html.find('class="recipes"')
    mats = []
    if i > 0:
        j = html.find("</div>\n</div>", i)
        blk = html[i : j if j > 0 else i + 3000]
        for href, q in re.findall(r'href="([^"]+)"><img[^>]*/>[^<]*</a></div>\s*<div>(\d+)</div>', blk):
            mats.append({"id": href, "qty": int(q)})
    info["mats"] = mats
    return info


def parse_tech(html):
    """name -> {lv, cost, ancient} for structure ('건축물') technologies."""
    out = {}
    for row in html.split('<div class="col pt-2 pb-1 border-bottom">')[1:]:
        lv = re.search(r"<div>(\d+)</div>", row)
        for cls, cost, kind, name in re.findall(
            r'class="d-inline-block hoverTech ([^"]*)"[^>]*>\s*<div class="hoverTechCost badge">(\d+)</div>\s*'
            r'<div class="hoverTechHeader">([^<]*)</div>\s*<div class="hoverTechFooter">([^<]*)</div>',
            row,
        ):
            if kind.strip() == "건축물":
                out.setdefault(unescape(name), {"lv": int(lv.group(1)) if lv else None, "cost": int(cost), "ancient": "Boss" in cls})
    return out


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    ICONS.mkdir(parents=True, exist_ok=True)
    structs = parse_list(get(BASE + "Structures"))
    print("structures on list:", len(structs))
    tech = parse_tech(get(BASE + "Technologies"))
    print("structure techs:", len(tech))

    def work(s):
        try:
            s.update(parse_detail(get(BASE + quote(s["id"], safe="%/_()'-!,.:&"))))
        except Exception as e:  # noqa: BLE001
            print("FAIL", s["id"], e, file=sys.stderr)
            s["failed"] = True

    with ThreadPoolExecutor(4) as ex:
        list(ex.map(work, structs.values()))

    res = [s for s in structs.values() if not s.get("failed")]
    fix_names(res)
    for s in res:
        s["icon"] = s.pop("iconUrl").rsplit("/", 1)[-1]
        if s["name"] in tech:
            s["tech"] = tech[s["name"]]

    urls = {}
    for s in structs.values():
        pass

    def dl(name):
        p = ICONS / name
        if not p.exists():
            for base in (
                "https://cdn.paldb.cc/image/Pal/Texture/BuildObject/PNG/",
                "https://cdn.paldb.cc/image/Pal/Texture/UI/InGame/",
            ):
                try:
                    p.write_bytes(get(base + name, binary=True))
                    return
                except Exception:  # noqa: BLE001
                    continue
            print("ICON FAIL", name, file=sys.stderr)

    names = {s["icon"] for s in res} | {w["icon"] for s in res for w in s.get("works", [])}
    with ThreadPoolExecutor(6) as ex:
        list(ex.map(dl, names))
    (OUT / "structs.json").write_text(json.dumps(res, ensure_ascii=False), encoding="utf8")
    print("saved", len(res), "structures,", len(names), "icons")


if __name__ == "__main__":
    main()
