"""Keep reachable assets of recent approved frontends so already-open tabs still work."""

import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile


def retain(dist, previous):
    """Follow actual HTML/JS/CSS references; do not recursively retain obsolete bundles."""
    assets = {path.name: path for path in (previous / "assets").iterdir() if path.is_file() and not path.is_symlink()}
    pending = [(previous / "index.html").read_text()]
    seen = set()
    while pending:
        text = pending.pop()
        for name, path in assets.items():
            if name in seen or name not in text:
                continue
            seen.add(name)
            target = dist / "assets" / name
            if target.exists():
                if target.read_bytes() != path.read_bytes():
                    raise ValueError("IMMUTABLE_ASSET_COLLISION")
            else:
                shutil.copyfile(path, target)
            if path.suffix in (".js", ".css"):
                pending.append(path.read_text())
    return len(seen)


def main():
    """Download only the last three canonical immutable frontend publications."""
    backend, dist, revision = map(str, sys.argv[1:])
    sys.path.insert(0, str(Path(backend) / "src/Operations.Frontend"))
    import frontend_contract as contract
    from frontend_runtime import download
    result = subprocess.run(["gh", "api", "repos/jenngllg/mon-kado-front/releases?per_page=20"], capture_output=True, check=True, timeout=30)
    if len(result.stdout) > 4 * 1024 * 1024:
        raise ValueError("RELEASE_METADATA_TOO_LARGE")
    releases = json.loads(result.stdout)
    retained = 0
    for release in releases:
        tag = release.get("tag_name", "")
        if not re.fullmatch(r"frontend-[0-9a-f]{40}", tag) or tag == "frontend-" + revision or release.get("draft") or release.get("prerelease"):
            continue
        with tempfile.TemporaryDirectory(prefix="retained-frontend-") as temporary:
            staging = Path(temporary)
            base = "https://github.com/jenngllg/mon-kado-front/releases/download/" + tag + "/"
            download(base + "manifest.json", staging / "manifest.json", 4096)
            manifest = json.loads((staging / "manifest.json").read_text())
            contract.validate(manifest, manifest["configurationHash"], manifest["backendRevision"])
            if manifest["revision"] != tag[len("frontend-"):]:
                raise ValueError("FRONTEND_MANIFEST_CHANGED")
            download(base + "frontend.tar.gz", staging / "frontend.tar.gz", contract.MAX_COMPRESSED)
            contract.extract(staging / "frontend.tar.gz", staging / "files", manifest)
            retain(Path(dist), staging / "files")
        retained += 1
        if retained == 3:
            break
    print("Recent frontend assets retained for open tabs.")


if __name__ == "__main__":
    main()
