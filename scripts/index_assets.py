#!/usr/bin/env python3
"""
index_assets.py — LiftTilYaDie FULL Asset Inventory

Walks the entire public/LiftTilYaDie/ directory tree (every file, every
subdirectory) and produces a comprehensive inventory CSV.

For each file it records:
  - relative path from LiftTilYaDie root
  - file type / category (image, html, pdf, css, etc.)
  - whether it is referenced from w8lift.htm and in what way
    (href, img_src, link_href, script_src, etc.)
  - whether it already appears in results_index.csv
  - file size

This is a SEPARATE output from results_index.csv (which remains untouched).
Output: scripts/output/assets_index.csv

Usage (from repo root):
    python scripts/index_assets.py
"""

import csv
import re
import sys
from pathlib import Path

try:
    from bs4 import BeautifulSoup
except ImportError:
    print("ERROR: beautifulsoup4 not installed. Run: pip install beautifulsoup4")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

REPO_ROOT       = Path(__file__).parent.parent
ARCHIVE_ROOT    = REPO_ROOT / "public" / "LiftTilYaDie"
W8LIFT_PATH     = ARCHIVE_ROOT / "w8lift.htm"
OUTPUT_DIR      = Path(__file__).parent / "output"
RESULTS_CSV     = OUTPUT_DIR / "results_index.csv"
OUTPUT_CSV      = OUTPUT_DIR / "assets_index.csv"

# ---------------------------------------------------------------------------
# File categorisation
# ---------------------------------------------------------------------------

CATEGORY_MAP = {
    # images
    ".gif":  "image",
    ".jpg":  "image",
    ".jpeg": "image",
    ".png":  "image",
    ".bmp":  "image",
    ".webp": "image",
    ".svg":  "image",
    ".ico":  "image",
    # documents/structured data
    ".htm":  "html",
    ".html": "html",
    ".pdf":  "pdf",
    ".xls":  "excel",
    ".xlsx": "excel",
    ".doc":  "word",
    ".docx": "word",
    ".txt":  "text",
    ".csv":  "text",
    # web assets
    ".css":  "stylesheet",
    ".js":   "javascript",
    # misc
    ".json": "data",
    ".xml":  "data",
    ".zip":  "archive",
}


def categorise(path: Path) -> str:
    return CATEGORY_MAP.get(path.suffix.lower(), "other")


# ---------------------------------------------------------------------------
# Step 1 — Extract all references from w8lift.htm
#
# We want to detect every way a file can be cited:
#   <a href="...">          → href
#   <img src="...">         → img_src
#   <link href="...">       → link_href
#   <script src="...">      → script_src
#   <frame src="...">       → frame_src
#   background="..."        → bg_attr   (old HTML bgcolor attribute)
# ---------------------------------------------------------------------------

def normalize_ref(ref: str) -> str:
    """
    Normalise a raw href/src to a lowercase path without fragment/query.
    Returns empty string for absolute URLs or anchor-only refs.
    """
    ref = ref.strip()
    if ref.startswith("http") or ref.startswith("mailto") or ref.startswith("javascript"):
        return ""
    if ref.startswith("#"):
        return ""
    ref = ref.split("#")[0].split("?")[0]   # strip fragment + query
    ref = ref.replace("\\", "/").lower()
    return ref


def get_w8lift_references(path: Path) -> dict[str, list[str]]:
    """
    Parse w8lift.htm and return a dict mapping normalized relative path
    to a list of reference types, e.g.:
      {'results/96marin.htm': ['href'], 'shoe2.gif': ['img_src']}
    """
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        soup = BeautifulSoup(f, "html.parser")

    refs: dict[str, list[str]] = {}

    def add(raw: str, ref_type: str):
        n = normalize_ref(raw)
        if n:
            refs.setdefault(n, [])
            if ref_type not in refs[n]:
                refs[n].append(ref_type)

    # <a href>
    for tag in soup.find_all("a", href=True):
        add(tag["href"], "href")

    # <img src>
    for tag in soup.find_all("img", src=True):
        add(tag["src"], "img_src")

    # <link href>  (stylesheets, favicons, etc.)
    for tag in soup.find_all("link", href=True):
        add(tag["href"], "link_href")

    # <script src>
    for tag in soup.find_all("script", src=True):
        add(tag["src"], "script_src")

    # <frame src> / <iframe src>
    for tag in soup.find_all(["frame", "iframe"], src=True):
        add(tag["src"], "frame_src")

    # background="..." attribute on any tag (old <body background="..."> etc.)
    for tag in soup.find_all(background=True):
        add(tag["background"], "bg_attr")

    return refs


# ---------------------------------------------------------------------------
# Step 2 — Load existing results_index.csv filenames for cross-reference
# ---------------------------------------------------------------------------

def load_results_index_filenames(csv_path: Path) -> set[str]:
    """Return lowercase filenames that already appear in results_index.csv."""
    if not csv_path.exists():
        return set()
    with open(csv_path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return {row["filename"].lower() for row in reader}


# ---------------------------------------------------------------------------
# Step 3 — Walk the entire tree
# ---------------------------------------------------------------------------

def walk_archive(root: Path):
    """
    Yield (path, rel_path_str) for every file under root, recursively.
    rel_path_str is POSIX-style, relative to root (no leading slash).
    """
    for p in sorted(root.rglob("*")):
        if p.is_file():
            rel = p.relative_to(root).as_posix()
            yield p, rel


# ---------------------------------------------------------------------------
# Step 4 — Build inventory rows
# ---------------------------------------------------------------------------

def build_inventory(
    archive_root: Path,
    w8lift_refs: dict[str, list[str]],
    results_filenames: set[str],
) -> list[dict]:
    rows = []

    for path, rel_posix in walk_archive(archive_root):
        rel_lower = rel_posix.lower()
        filename = path.name
        category = categorise(path)
        size = path.stat().st_size

        # Subdirectory (first component of path)
        parts = rel_posix.split("/")
        subdir = parts[0] if len(parts) > 1 else "(root)"

        # Check w8lift references
        ref_types = w8lift_refs.get(rel_lower, [])

        # Some files in root are referenced without a path prefix,
        # e.g. "shoe2.gif" → key is just "shoe2.gif"
        # Others in Results/ are referenced as "results/96marin.htm"
        # The normalize fn lowercases both so both resolve correctly above.
        referenced = bool(ref_types)
        reference_type = "; ".join(ref_types) if ref_types else ""

        # Cross-reference with results_index.csv
        in_results_index = filename.lower() in results_filenames

        # Notes
        notes = []
        if in_results_index:
            notes.append("in_results_index")
        if size == 0:
            notes.append("empty_file")
        # Encoded/percent-encoded filenames (e.g. "w8lift.htm%5D")
        if "%" in filename:
            notes.append("percent_encoded_name")
        # Duplicate ico (dimas.ico and favicon.ico are the same file)
        if filename.lower() in ("dimas.ico", "favicon.ico") and size == 822:
            notes.append("identical_to_other_ico")

        rows.append({
            "filename":       filename,
            "rel_path":       rel_posix,
            "subdir":         subdir,
            "category":       category,
            "file_size_bytes": size,
            "referenced_from_w8lift": referenced,
            "reference_type": reference_type,
            "in_results_index": in_results_index,
            "notes":          "; ".join(notes),
        })

    return rows


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print(f"Archive root : {ARCHIVE_ROOT}")
    print(f"Parsing w8lift.htm for all references...")
    w8lift_refs = get_w8lift_references(W8LIFT_PATH)
    print(f"  -> {len(w8lift_refs)} unique resource references found")

    print(f"Loading results_index.csv filenames for cross-reference...")
    results_filenames = load_results_index_filenames(RESULTS_CSV)
    print(f"  -> {len(results_filenames)} filenames in results_index.csv")

    print(f"Walking LiftTilYaDie/ tree...")
    rows = build_inventory(ARCHIVE_ROOT, w8lift_refs, results_filenames)

    # Summary
    total = len(rows)
    referenced = sum(1 for r in rows if r["referenced_from_w8lift"])
    unreferenced = total - referenced

    # Breakdown by category
    from collections import Counter
    cat_counts = Counter(r["category"] for r in rows)
    ref_by_type = Counter()
    for r in rows:
        for rt in r["reference_type"].split("; "):
            if rt:
                ref_by_type[rt] += 1

    # Breakdown by subdir
    subdir_counts = Counter(r["subdir"] for r in rows)

    print()
    print("=" * 60)
    print("SUMMARY")
    print(f"  Total files          : {total}")
    print(f"  Referenced in w8lift : {referenced}")
    print(f"  NOT referenced       : {unreferenced}")
    print()
    print("  By category:")
    for cat, count in sorted(cat_counts.items(), key=lambda x: -x[1]):
        print(f"    {cat:15s} {count}")
    print()
    print("  Reference types (files can have multiple):")
    for rt, count in sorted(ref_by_type.items(), key=lambda x: -x[1]):
        print(f"    {rt:15s} {count}")
    print()
    print("  By subdirectory:")
    for sd, count in sorted(subdir_counts.items(), key=lambda x: -x[1]):
        print(f"    {sd:25s} {count}")

    # Write output
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "filename", "rel_path", "subdir", "category",
        "file_size_bytes", "referenced_from_w8lift", "reference_type",
        "in_results_index", "notes",
    ]
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print()
    print(f"Output written to: {OUTPUT_CSV}")

    # Print unreferenced non-result files for quick review
    print()
    print("UNREFERENCED non-Results files (not in results_index, not in PWA/):")
    for r in rows:
        if (not r["referenced_from_w8lift"]
                and not r["in_results_index"]
                and r["subdir"] not in ("Results", "PWA")):
            print(f"  [{r['subdir']:12s}] [{r['category']:10s}] {r['rel_path']}")


if __name__ == "__main__":
    main()
