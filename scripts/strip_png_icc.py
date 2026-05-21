"""Remove ICC profile from PNG files so alpha displays correctly in browsers/viewers."""
import glob
import sys

from PIL import Image


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: strip_png_icc.py <folder>", file=sys.stderr)
        return 1
    folder = sys.argv[1]
    paths = sorted(glob.glob(f"{folder}/*.png"))
    if not paths:
        return 0
    for path in paths:
        with Image.open(path) as im:
            im.save(path, format="PNG", icc_profile=None)
    print(f"stripped ICC from {len(paths)} PNG(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
