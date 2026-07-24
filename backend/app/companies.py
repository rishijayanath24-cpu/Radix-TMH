"""
Loads the company 12-skillset bars used by Talent Check.

Reads data/talent_check_company_skillsets.json (repo root). Resolves a company
by exact name or alias, with a fuzzy fallback so a JD that says "Google" still
matches the "Google LLC" bar.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from rapidfuzz import fuzz

# backend/app/companies.py -> repo root is two levels up from backend/
_DATA_FILE = Path(__file__).resolve().parents[2] / "data" / "talent_check_company_skillsets.json"


@lru_cache(maxsize=1)
def _load() -> list[dict]:
    if not _DATA_FILE.exists():
        return []
    with open(_DATA_FILE, encoding="utf-8") as fh:
        return json.load(fh).get("companies", [])


def list_companies() -> list[dict]:
    """[{name, skillsets}] for populating the company dropdown."""
    return [{"name": c["name"], "skillsets": c["skillsets"]} for c in _load()]


def get_bar(company: str) -> dict[str, int]:
    """Resolve a company name/alias to its {category_code: required_level} bar."""
    if not company:
        return {}
    q = company.strip().lower()
    companies = _load()

    # exact name / alias
    for c in companies:
        names = [c["name"].lower()] + [a.lower() for a in c.get("aliases", [])]
        if q in names:
            return {k: int(v) for k, v in c["skillsets"].items()}

    # substring (e.g. "google llc — software engineer" contains "google")
    for c in companies:
        names = [c["name"].lower()] + [a.lower() for a in c.get("aliases", [])]
        if any(n in q or q in n for n in names):
            return {k: int(v) for k, v in c["skillsets"].items()}

    # fuzzy fallback
    best, best_score = None, 0
    for c in companies:
        score = fuzz.partial_ratio(q, c["name"].lower())
        if score > best_score:
            best, best_score = c, score
    if best and best_score >= 70:
        return {k: int(v) for k, v in best["skillsets"].items()}
    return {}
