# Palworld Helper

A personal Palworld helper site (Korean UI). Vite + React + TypeScript, managed with pnpm.

- **Map**: pannable / zoomable map of the Palpagos Islands.
- **Pals / Structures**: element and work-suitability browsing, spawn map, tech points.
- **Items**: hierarchical item tree with search, item icons, crafting materials and the total base materials needed for N crafts.

## Run

```bash
pnpm install
pnpm dev
```

## Data

Item data, icons and the map image are fan-site derived (paldb.cc, Korean) and stored in `public/`. Game assets belong to Pocketpair; personal use only.

```bash
pnpm fetch-data               # items.json + icons (raw HTML cached in .local/cache)
python -I scripts/fetch_pals.py    # pals.json + spawn coordinates
python -I scripts/fetch_structs.py # structs.json
python -I scripts/fetch_markers.py # map markers (fast travel, towers, alpha pals, dungeons)
python -I scripts/fetch_map.py  # stitched map image (needs Pillow)
```
