# List artwork

These are decorative occasion covers, never member photos or private wish previews.
All assets are bundled and served locally; displaying them contacts no external
image service. Icons and botanical decorations retain the
existing user-approved mockup artwork.

## User-selected photographs

The birthday, Christmas, wedding, birth and eucalyptus (Other) photos are used under the
[Pexels license](https://www.pexels.com/license/),
checked on 2026-10-08. It permits free website use and modification; these images
are not sold or redistributed as stock photography and imply no endorsement.
Attribution is optional under this license, irrespective of the zero price;
no public legal-page credit is required for these photographs. Other image licenses may
require attribution even when their download is free.

Preparation: `python tools/build-occasion-covers.py` (Pillow required). The script
resizes/crops to 800 × 1000 pixels (4:5), preserves the wedding rings with a
bottom-aligned crop and centres the cream/beige baby layette (no visible feet or people)
and eucalyptus on a white background,
strips metadata and encodes WebP within an 80 KiB per-image
budget. Only optimized assets are saved; source JPEGs are not kept in the repository.

Use `python tools/build-occasion-covers.py --occasion christmas` (or another
occasion) to rebuild only that cover without changing the other images.

Current outputs: birthday 30,990 bytes, Christmas 40,994 bytes, wedding 39,982
bytes, birth 80,420 bytes and Other 33,584 bytes (225,970 bytes combined).
