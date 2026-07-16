"""One-off: pull the CloudFront PNGs into src/assets as WebP.

A portfolio piece should not depend on a third party's CDN path. Run once with
the repo's venv Pillow; the WebP outputs are committed, so this need not run
again unless a source image changes.
"""
from __future__ import annotations

import io
import urllib.request
from pathlib import Path

from PIL import Image

BASE = "https://d8j0ntlcm91z4.cloudfront.net/user_33IJIDZ0cOmwdzXkCP5nbQryjVC/"
IMAGES = {
    "orb": "hf_20260618_184056_8486b8b4-b288-4344-996a-53ea801af5bc.png",
    "data": "hf_20260618_184103_c3dd220e-bda5-4964-8a2d-0e87b9fd77dd.png",
    "wave": "hf_20260618_184108_568fd0ad-6da7-4830-962a-35a70bf8d220.png",
    "step-upload": "hf_20260619_105340_e82eb3e8-ca18-4a12-a2a4-0a17fa185ae7.png",
    "step-analyze": "hf_20260619_105345_3d63247e-224a-4452-9886-fc6bafea6e9c.png",
    "step-decide": "hf_20260619_105350_b7e7816d-3170-4cfb-9f07-be85ce02fce0.png",
    "logo": "hf_20260621_113356_37574f61-266d-4c83-a8e0-bdd07a191331.png",
}
OUT = Path(__file__).parent.parent / "src" / "assets"
OUT.mkdir(parents=True, exist_ok=True)

for name, fn in IMAGES.items():
    raw = urllib.request.urlopen(BASE + fn, timeout=30).read()
    img = Image.open(io.BytesIO(raw)).convert("RGBA")
    dst = OUT / f"{name}.webp"
    img.save(dst, "WEBP", quality=82, method=6)
    print(f"{dst.name}: {img.width}x{img.height}, {dst.stat().st_size // 1024} KB")
