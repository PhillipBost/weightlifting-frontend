#!/usr/bin/env python3
"""
index_results.py — LiftTilYaDie Results Archive Indexer

Scans all result files in:
  - public/LiftTilYaDie/*.htm  (root pool)
  - public/LiftTilYaDie/Results/*.htm + *.pdf + *.xls  (Results pool)

For each file:
  - Checks if it is linked from w8lift.htm (or is an orphan)
  - Extracts: meet name, date, location, primary source, notes

Outputs: scripts/output/results_index.csv  +  scripts/output/results_index.json

Usage (from repo root):
    python scripts/index_results.py
"""

import csv
import json
import os
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

REPO_ROOT = Path(__file__).parent.parent
ARCHIVE_ROOT = REPO_ROOT / "public" / "LiftTilYaDie"
RESULTS_DIR = ARCHIVE_ROOT / "Results"
W8LIFT_PATH = ARCHIVE_ROOT / "w8lift.htm"
OUTPUT_DIR = Path(__file__).parent / "output"

# ---------------------------------------------------------------------------
# Files to skip in the root LiftTilYaDie/ directory (non-result pages)
# ---------------------------------------------------------------------------

ROOT_SKIP_PREFIXES = ("w8lift", "w8lift2", "Page2", "PAGE_2", "index")
ROOT_SKIP_SUBSTRINGS = (
    "Schedl", "Entr", "EntryFrm", "alladvantage", "WTT",
    "BadMother", "BdMoEntr", "CAStEnt", "FirstWorld", "WorldTeamTrials",
    "pwa",  # pwa.htm is the PWA index, not a result
)
ROOT_SKIP_EXACT = {
    "results.htm",       # directory listing placeholder
    "wsthsent.htm",      # Western States HS entry form
    "99lstacha.htm",     # another entry/admin page
    "99lstcha.htm",      # entry/admin page variant
}

# ---------------------------------------------------------------------------
# Step 1 — Extract all linked hrefs from w8lift.htm
# ---------------------------------------------------------------------------

def normalize_href(href: str) -> str:
    """
    Normalize an href to a lowercase relative path without fragment.
    e.g. 'Results/13University.htm#TRIALS' -> 'results/13university.htm'
    """
    href = href.split("#")[0].strip()         # strip fragment
    href = href.replace("\\", "/")
    return href.lower()


def get_linked_paths(w8lift_path: Path) -> set[str]:
    """
    Parse w8lift.htm and return a set of normalized relative paths
    that are linked from it (relative to ARCHIVE_ROOT).
    """
    with open(w8lift_path, "r", encoding="utf-8", errors="replace") as f:
        soup = BeautifulSoup(f, "html.parser")

    linked = set()
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        # Only care about local result links (not http/mailto/anchors-only)
        if href.startswith("http") or href.startswith("mailto") or href.startswith("#"):
            continue
        normalized = normalize_href(href)
        if normalized:
            linked.add(normalized)

    return linked


# ---------------------------------------------------------------------------
# Step 2 — Collect files to index
# ---------------------------------------------------------------------------

def is_root_result(filename: str) -> bool:
    """Return True if a root-level .htm file looks like a result page."""
    name = filename
    # Must be .htm
    if not name.lower().endswith(".htm"):
        return False
    # Skip exact-match non-result files
    if name.lower() in ROOT_SKIP_EXACT:
        return False
    # Skip known non-result files by prefix/substring
    base = Path(name).stem
    for prefix in ROOT_SKIP_PREFIXES:
        if base.lower().startswith(prefix.lower()):
            return False
    for sub in ROOT_SKIP_SUBSTRINGS:
        if sub.lower() in base.lower():
            return False
    return True


def collect_files():
    """
    Returns list of dicts: {path: Path, pool: str, rel_path: str}
    rel_path is relative to ARCHIVE_ROOT, normalized lowercase, for orphan lookup.
    """
    files = []

    # Root pool
    for f in sorted(ARCHIVE_ROOT.iterdir()):
        if f.is_file() and is_root_result(f.name):
            files.append({
                "path": f,
                "pool": "root",
                "rel_path": f.name.lower(),
            })

    # Results pool — all files (htm, pdf, xls)
    extensions = {".htm", ".html", ".pdf", ".xls", ".xlsx"}
    for f in sorted(RESULTS_DIR.iterdir()):
        if f.is_file() and f.suffix.lower() in extensions:
            files.append({
                "path": f,
                "pool": "Results",
                "rel_path": f"results/{f.name.lower()}",
            })

    return files


# ---------------------------------------------------------------------------
# Step 3 — Metadata extraction helpers
# ---------------------------------------------------------------------------

MONTH_NAMES = (
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
    "Jan", "Feb", "Mar", "Apr", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
)

# Patterns for dates
DATE_RANGE_RE = re.compile(
    r"(" + "|".join(MONTH_NAMES) + r")\s+(\d{1,2})\s*[-–]\s*(\d{1,2}),\s*(\d{4})",
    re.IGNORECASE,
)
DATE_SINGLE_RE = re.compile(
    r"(" + "|".join(MONTH_NAMES) + r")\s+(\d{1,2}),\s*(\d{4})",
    re.IGNORECASE,
)
DATE_MONTH_YEAR_RE = re.compile(
    r"(" + "|".join(MONTH_NAMES) + r")[,\s]+(\d{4})",
    re.IGNORECASE,
)
YEAR_FROM_FILENAME_RE = re.compile(r"^(\d{2})")   # e.g. 96Marin -> 96


MONTH_MAP = {m.lower(): str(i + 1).zfill(2) for i, m in enumerate([
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
    "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"
])}
# fix abbrev offset
for abbr, full in zip(
    ["jan","feb","mar","apr","jun","jul","aug","sep","oct","nov","dec"],
    ["01","02","03","04","06","07","08","09","10","11","12"]
):
    MONTH_MAP[abbr] = full


def month_to_num(month_str: str) -> str:
    return MONTH_MAP.get(month_str.lower()[:3], "??")


def year_from_filename(filename: str) -> str | None:
    """Try to infer 4-digit year from 2-digit filename prefix."""
    stem = Path(filename).stem
    m = YEAR_FROM_FILENAME_RE.match(stem)
    if not m:
        return None
    yy = int(m.group(1))
    # Heuristic: 00–30 → 2000–2030, 31–99 → 1931–1999
    if yy <= 30:
        return str(2000 + yy)
    else:
        return str(1900 + yy)


def extract_text_for_body(soup: BeautifulSoup, max_chars: int = 800) -> str:
    """Extract a flat string of the first ~max_chars characters of visible body text."""
    body = soup.find("body") or soup
    text = body.get_text(separator=" ", strip=True)
    return text[:max_chars]


def extract_caption_lines(soup: BeautifulSoup) -> list[str]:
    """Extract lines from the first <caption> tag, or from prominent font tags."""
    lines = []
    caption = soup.find("caption")
    if caption:
        raw = caption.get_text(separator="\n", strip=True)
        lines = [l.strip() for l in raw.splitlines() if l.strip()]
    return lines


def extract_meet_name(soup: BeautifulSoup) -> str:
    """Extract meet name: prefer <title>, then first caption line."""
    title = soup.find("title")
    if title and title.string:
        t = title.string.strip()
        if t:
            return t
    lines = extract_caption_lines(soup)
    if lines:
        return lines[0]
    # Fallback: first <h1>
    h1 = soup.find("h1")
    if h1:
        return h1.get_text(strip=True)
    return ""


def extract_date_and_location(soup: BeautifulSoup, filename: str):
    """
    Returns (date_raw, date_start, date_end, location).
    Searches caption lines first, then body text.
    """
    caption_lines = extract_caption_lines(soup)
    body_text = extract_text_for_body(soup, max_chars=1200)

    # Search in caption lines then body
    search_texts = caption_lines + [body_text]

    date_raw = ""
    date_start = ""
    date_end = ""
    location = ""

    for text in search_texts:
        if not date_raw:
            # Try date range: "March 28 - 30, 2003"
            m = DATE_RANGE_RE.search(text)
            if m:
                month, d1, d2, year = m.group(1), m.group(2), m.group(3), m.group(4)
                date_raw = m.group(0)
                mn = month_to_num(month)
                date_start = f"{year}-{mn}-{d1.zfill(2)}"
                date_end = f"{year}-{mn}-{d2.zfill(2)}"
                continue

            # Try single date: "March 16, 1996"
            m = DATE_SINGLE_RE.search(text)
            if m:
                month, day, year = m.group(1), m.group(2), m.group(3)
                date_raw = m.group(0)
                mn = month_to_num(month)
                date_start = f"{year}-{mn}-{day.zfill(2)}"
                date_end = date_start
                continue

            # Try month + year only: "November 2001"
            m = DATE_MONTH_YEAR_RE.search(text)
            if m:
                month, year = m.group(1), m.group(2)
                date_raw = m.group(0)
                mn = month_to_num(month)
                date_start = f"{year}-{mn}"
                date_end = ""
                # don't break — keep scanning for a better date

    # If still no date, try year from filename
    if not date_start:
        y = year_from_filename(filename)
        if y:
            date_raw = y
            date_start = y
            date_end = ""

    # Location: look in caption lines (usually 2nd or 3rd line)
    # Pattern: text containing a comma (City, State) and NOT containing a year
    for line in caption_lines[1:]:
        # Skip lines that look like the meet name (usually no comma or all caps)
        if re.search(r"\d{4}", line):
            # This line has the date — but might also have location
            # Try to strip date part
            stripped = re.sub(r"\b\w+ \d{1,2}\s*[-–]?\s*\d{0,2},?\s*\d{4}\b", "", line).strip().strip(",").strip()
            if stripped and len(stripped) > 3:
                location = stripped
            continue
        if "," in line or len(line) > 5:
            location = line
            break

    # If still no location, search body text for "City, ST" patterns
    if not location:
        loc_pattern = re.compile(r"([A-Z][a-zA-Z\s]+,\s+[A-Z]{2})")
        m = loc_pattern.search(body_text)
        if m:
            location = m.group(1).strip()

    return date_raw, date_start, date_end, location


SOURCE_PATTERNS = [
    (re.compile(r"Denis\s+Reno", re.IGNORECASE), "Denis Reno's Newsletter"),
    (re.compile(r"Weightlifting\s+USA", re.IGNORECASE), "Weightlifting USA"),
    (re.compile(r"Bob\s+Hise|Hise\s+report", re.IGNORECASE), "Hise Report"),
    (re.compile(r"Jim\s+Schmitz", re.IGNORECASE), "Jim Schmitz"),
]


def extract_source(soup: BeautifulSoup) -> str:
    """Look for known newsletter/source attributions in body text."""
    body_text = extract_text_for_body(soup, max_chars=3000)
    for pattern, label in SOURCE_PATTERNS:
        if pattern.search(body_text):
            return label
    return ""


def extract_notes(path: Path, soup: BeautifulSoup | None, pool: str,
                  all_result_names: set[str], all_root_names: set[str]) -> list[str]:
    """Build a list of interesting flags for the notes column."""
    notes = []
    filename = path.name
    stem = path.stem.lower()
    suffix = path.suffix.lower()

    if suffix == ".xls" or suffix == ".xlsx":
        notes.append("xls_file")
        return notes

    if suffix == ".pdf":
        notes.append("pdf_file")
        return notes

    if "_viewer" in stem:
        notes.append("pdf_viewer_stub")
        return notes

    if soup is None:
        notes.append("parse_error")
        return notes

    # File size check
    size = path.stat().st_size
    if size < 1000:
        notes.append(f"stub_file_{size}b")

    # Temp/draft
    if "temp" in stem:
        notes.append("possible_draft_or_temp")

    # Duplicate: if Results/ file also exists as root file (or vice versa)
    if pool == "Results":
        if filename.lower() in all_root_names:
            notes.append("duplicate_exists_in_root")
    elif pool == "root":
        if filename.lower() in all_result_names:
            notes.append("duplicate_exists_in_Results")

    # Has record notations
    body_text = extract_text_for_body(soup, 5000)
    if "RECORD" in body_text:
        notes.append("has_record_notations")

    # Multiple meets in one file (heuristic: body > 150kb and has multiple dates)
    if size > 150_000:
        notes.append("large_file_possibly_multi_meet")

    # Anchor links in w8lift that point into this file (already handled in main)

    return notes


# ---------------------------------------------------------------------------
# Step 4 — Process each file
# ---------------------------------------------------------------------------

def process_file(entry: dict, linked_paths: set[str],
                 all_result_names: set[str], all_root_names: set[str]) -> dict:
    path: Path = entry["path"]
    pool: str = entry["pool"]
    rel_path: str = entry["rel_path"]   # already normalized lowercase
    filename = path.name
    suffix = path.suffix.lower()

    linked_from_root = rel_path in linked_paths

    size = path.stat().st_size

    # Default record
    record = {
        "filename": filename,
        "pool": pool,
        "file_path": str(path.relative_to(REPO_ROOT)).replace("\\", "/"),
        "linked_from_root": linked_from_root,
        "meet_name": "",
        "date_raw": "",
        "date_start": "",
        "date_end": "",
        "location": "",
        "source": "",
        "file_size_bytes": size,
        "notes": "",
    }

    # Non-HTML files
    if suffix in (".pdf", ".xls", ".xlsx"):
        notes = extract_notes(path, None, pool, all_result_names, all_root_names)
        # Try to infer year from filename for non-HTML
        y = year_from_filename(filename)
        if y:
            record["date_raw"] = y
            record["date_start"] = y
        record["notes"] = "; ".join(notes)
        return record

    # HTML files
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            html = f.read()
        soup = BeautifulSoup(html, "html.parser")
    except Exception as e:
        record["notes"] = f"parse_error: {e}"
        return record

    record["meet_name"] = extract_meet_name(soup)

    date_raw, date_start, date_end, location = extract_date_and_location(soup, filename)
    record["date_raw"] = date_raw
    record["date_start"] = date_start
    record["date_end"] = date_end
    record["location"] = location

    record["source"] = extract_source(soup)

    notes = extract_notes(path, soup, pool, all_result_names, all_root_names)
    record["notes"] = "; ".join(notes)

    return record


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print(f"Archive root: {ARCHIVE_ROOT}")
    print(f"Reading w8lift.htm...")

    linked_paths = get_linked_paths(W8LIFT_PATH)
    print(f"  -> {len(linked_paths)} linked hrefs found in w8lift.htm")

    print("Collecting files...")
    files = collect_files()

    # Build lookup sets for duplicate detection
    all_result_names = {
        Path(e["path"].name).name.lower()
        for e in files if e["pool"] == "Results"
    }
    all_root_names = {
        Path(e["path"].name).name.lower()
        for e in files if e["pool"] == "root"
    }

    print(f"  -> {len(files)} files to index "
          f"({sum(1 for e in files if e['pool'] == 'root')} root, "
          f"{sum(1 for e in files if e['pool'] == 'Results')} Results)")

    results = []
    for i, entry in enumerate(files):
        if (i + 1) % 50 == 0:
            print(f"  Processing file {i+1}/{len(files)}...")
        rec = process_file(entry, linked_paths, all_result_names, all_root_names)
        results.append(rec)

    # Write output
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    csv_path = OUTPUT_DIR / "results_index.csv"
    json_path = OUTPUT_DIR / "results_index.json"

    fieldnames = [
        "filename", "pool", "file_path", "linked_from_root",
        "meet_name", "date_raw", "date_start", "date_end",
        "location", "source", "file_size_bytes", "notes",
    ]

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    # Summary
    total = len(results)
    linked_count = sum(1 for r in results if r["linked_from_root"])
    orphans = total - linked_count
    no_date = sum(1 for r in results if not r["date_start"])
    no_name = sum(1 for r in results if not r["meet_name"])

    print()
    print("=" * 50)
    print(f"SUMMARY")
    print(f"  Total files indexed : {total}")
    print(f"  Linked from w8lift  : {linked_count}")
    print(f"  Orphans             : {orphans}")
    print(f"  Missing date        : {no_date}")
    print(f"  Missing meet name   : {no_name}")
    print()

    # Print orphan list for immediate inspection
    print("ORPHANED FILES:")
    for r in results:
        if not r["linked_from_root"]:
            print(f"  [{r['pool']:8}] {r['filename']}")

    print()
    print(f"Output written to:")
    print(f"  {csv_path}")
    print(f"  {json_path}")


if __name__ == "__main__":
    main()
