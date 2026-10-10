"""Download z3 map tiles from paldb.cc and stitch them into public/map/palpagos.webp (4096x4096)."""
import io
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
Z, N, T = 3, 8, 512
canvas = Image.new("RGBA", (N * T, N * T), (0, 0, 0, 0))
for x in range(N):
    for y in range(N):
        url = f"https://cdn.paldb.cc/image/map8/z{Z}x{x}y{y}.webp"
        try:
            data = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=30).read()
        except Exception:  # missing tile = empty ocean
            continue
        canvas.paste(Image.open(io.BytesIO(data)).convert("RGBA"), (x * T, y * T))
# missing tiles are open ocean: fill with the ocean color sampled from a real tile
bg = Image.new("RGBA", canvas.size, canvas.getpixel((1025, 615)))
bg.alpha_composite(canvas)
canvas = bg.convert("RGB")
out = ROOT / "public" / "map" / "palpagos.webp"
canvas.save(out, "WEBP", quality=85)
print("saved", out, out.stat().st_size)
