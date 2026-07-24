"""
Bake a demo dataset for the frontend: parse every sample JD + resume once,
precompute Talent Check (per company) and Skill Match (per JD) for each
candidate, and write it to frontend/public/demo_data.json.

This lets the dashboard render real, differentiated data on first load without
needing a live upload or Supabase. Live uploads later override it.

Run from backend/:  python make_demo_data.py
"""

from __future__ import annotations

import json
from pathlib import Path

from app import companies
from app.extract import analyze_jd, analyze_resume, extract_text
from app.match import profile_from_resume, skill_match, talent_check

ROOT = Path(__file__).resolve().parents[1]
JD_DIR = ROOT / "JDs" / "PDF"
RESUME_DIR = ROOT / "Resumes" / "PDF"
OUT = ROOT / "frontend" / "public" / "demo_data.json"


def main() -> None:
    comp_list = companies.list_companies()

    print("Parsing JDs...")
    jds = []
    for pdf in sorted(JD_DIR.glob("*.pdf")):
        jd = analyze_jd(extract_text(pdf.name, pdf.read_bytes()), source_file=pdf.name)
        jds.append(jd)
        print(f"  {pdf.name}: {len(jd.skills)} skills")

    print("Parsing resumes + scoring...")
    candidates = []
    for pdf in sorted(RESUME_DIR.glob("*.pdf")):
        res = analyze_resume(extract_text(pdf.name, pdf.read_bytes()), source_file=pdf.name)
        profile = profile_from_resume(res)

        checks = []
        for c in comp_list:
            tc = talent_check(profile, c["name"], companies.get_bar(c["name"]))
            checks.append(tc.model_dump())

        matches = []
        for jd in jds:
            matches.append(skill_match(profile, jd).model_dump())
        matches.sort(key=lambda m: m["match_score"], reverse=True)

        candidates.append({
            "source_file": pdf.name,
            "profile": profile.model_dump(),
            "talent_checks": checks,
            "matches": matches,
        })
        print(f"  {res.name}: best match {matches[0]['match_score']}% ({matches[0]['role']})")

    payload = {
        "companies": comp_list,
        "jds": [jd.model_dump() for jd in jds],
        "candidates": candidates,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"\nWrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
