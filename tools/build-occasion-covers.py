"""Rebuild the approved Pexels covers without saving source-size downloads."""

import io
import json
import argparse
from pathlib import Path
from urllib.request import Request, urlopen

from PIL import Image, ImageOps


ASSET_DIRECTORY = Path(__file__).resolve().parents[1] / "src" / "assets" / "design"
SIZE = (800, 1000)
MAX_BYTES = 80 * 1024
COVERS = (
    ("birthday", "4110012", (0.5, 0.5)),
    ("christmas", "35193903", (0.5, 0.5)),
    ("wedding", "9400258", (0.5, 1.0)),
    ("birth", "16681603", (0.5, 0.5)),
    ("other", "6168330", (0.5, 0.5)),
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--occasion", choices=[cover[0] for cover in COVERS], help="Rebuild only this cover")
    args = parser.parse_args()
    results = []
    for name, photo_id, centering in COVERS:
        if args.occasion is not None and name != args.occasion:
            continue
        url = f"https://images.pexels.com/photos/{photo_id}/pexels-photo-{photo_id}.jpeg?w=1800&fit=max&fm=jpg"
        request = Request(url, headers={"User-Agent": "MonKado-asset-preparation/1.0"})
        with urlopen(request, timeout=30) as response:
            source_bytes = response.read(12 * 1024 * 1024 + 1)
        if len(source_bytes) > 12 * 1024 * 1024:
            raise ValueError("Unexpected source image size")
        with Image.open(io.BytesIO(source_bytes)) as source:
            image = ImageOps.exif_transpose(source).convert("RGB")
            if image.width < SIZE[0] or image.height < SIZE[1]:
                raise ValueError("Source image is too small")
            cover = ImageOps.fit(image, SIZE, method=Image.Resampling.LANCZOS, centering=centering)
        for quality in (80, 76, 72, 68, 64, 60, 56, 52, 48, 44, 40, 36, 32):
            encoded = io.BytesIO()
            cover.save(encoded, format="WEBP", quality=quality, method=6)
            payload = encoded.getvalue()
            if len(payload) <= MAX_BYTES:
                break
        else:
            raise ValueError(f"Optimized cover exceeds its size budget: {len(payload)} bytes")
        # Only resized, metadata-free WebP output is persisted; no JPEG originals.
        (ASSET_DIRECTORY / f"{name}.webp").write_bytes(payload)
        results.append({"occasion": name, "width": SIZE[0], "height": SIZE[1], "bytes": len(payload), "quality": quality})
    print(json.dumps(results))


if __name__ == "__main__":
    main()
