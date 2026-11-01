"""Verify old tabs' lazy imports survive without retaining an unbounded asset history."""

from pathlib import Path
import tempfile
import unittest
from retain_assets import retain


class RetentionTests(unittest.TestCase):
    def test_reachable_lazy_chunks_and_fonts_are_retained_but_obsolete_assets_are_not(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            old, new = root / "old", root / "new"
            for path in (old / "assets", new / "assets"):
                path.mkdir(parents=True)
            (old / "index.html").write_text('<script src="/assets/main-12345678.js"></script>')
            for name, value in {"main-12345678.js": 'import("./lazy-12345678.js");',
                                "lazy-12345678.js": '"style-12345678.css"',
                                "style-12345678.css": 'url("font-12345678.woff2")',
                                "font-12345678.woff2": "font", "obsolete-12345678.js": "unused"}.items():
                (old / "assets" / name).write_text(value)
            self.assertEqual(4, retain(new, old))
            self.assertFalse((new / "assets/obsolete-12345678.js").exists())
            (new / "assets/main-12345678.js").write_text("collision")
            with self.assertRaisesRegex(ValueError, "IMMUTABLE_ASSET_COLLISION"):
                retain(new, old)


if __name__ == "__main__":
    unittest.main()
