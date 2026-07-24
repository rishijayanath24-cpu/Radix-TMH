"""
End-to-end smoke test of the core engine against the REAL sample files.

Run from the backend/ folder:  python test_engine.py

It parses every sample JD + resume, then for one resume runs Talent Check
against all 3 companies and Skill Match against all 6 JDs — printing scores so
we can eyeball that different candidates get visibly different results.
"""

from __future__ import annotations

import sys
from pathlib import Path

from app import companies, llm
from app.extract import analyze_jd, analyze_resume, extract_text
from app.match import profile_from_resume, skill_match, talent_check

ROOT = Path(__file__).resolve().parents[1]
JD_DIR = ROOT / "JDs" / "PDF"
RESUME_DIR = ROOT / "Resumes" / "PDF"


def _read(path: Path) -> bytes:
    return path.read_bytes()


def main() -> None:
    print("=" * 70)
    print("LLM provider status:", llm.provider_status())
    print("=" * 70)

    # ---- parse all JDs ----
    jds = {}
    print("\n### JD ANALYTICS ###")
    for pdf in sorted(JD_DIR.glob("*.pdf")):
        text = extract_text(pdf.name, _read(pdf))
        jd = analyze_jd(text, source_file=pdf.name)
        jds[pdf.name] = jd
        codes = sorted({s.category_code for s in jd.skills})
        print(f"  {pdf.name:45s} company={jd.company!r:35s} skills={len(jd.skills):2d} cats={codes}")

    # ---- parse all resumes ----
    resumes = {}
    print("\n### RESUME PARSING ###")
    for pdf in sorted(RESUME_DIR.glob("*.pdf")):
        text = extract_text(pdf.name, _read(pdf))
        res = analyze_resume(text, source_file=pdf.name)
        resumes[pdf.name] = res
        codes = sorted({s.category_code for s in res.skills})
        print(f"  {pdf.name:28s} name={res.name!r:18s} skills={len(res.skills):2d} cats={codes}")

    # ---- Talent Check: every resume vs every company ----
    print("\n### TALENT CHECK (readiness_score per company) ###")
    comp_names = [c["name"] for c in companies.list_companies()]
    header = "  " + " " * 26 + "".join(f"{c[:16]:>18s}" for c in comp_names)
    print(header)
    for fname, res in resumes.items():
        profile = profile_from_resume(res)
        row = f"  {fname:26s}"
        for cname in comp_names:
            tc = talent_check(profile, cname, companies.get_bar(cname))
            row += f"{tc.readiness_score:>17d}%"
        print(row)

    # ---- Skill Match: every resume vs every JD ----
    print("\n### SKILL MATCH (match_score per JD) ###")
    for fname, res in resumes.items():
        profile = profile_from_resume(res)
        print(f"\n  Candidate: {res.name or fname}")
        for jd_name, jd in jds.items():
            sm = skill_match(profile, jd)
            print(f"    {jd_name:45s} {sm.match_score:3d}%  "
                  f"matched={len(sm.matched_skills)} missing={len(sm.missing_skills)}")

    # ---- one detailed example ----
    print("\n### DETAIL: first resume vs first JD ###")
    first_res = next(iter(resumes.values()))
    first_jd = next(iter(jds.values()))
    profile = profile_from_resume(first_res)
    sm = skill_match(profile, first_jd)
    print(f"  {first_res.name} vs {first_jd.source_file}: {sm.match_score}%")
    print("  matched :", sm.matched_skills)
    print("  missing :", sm.missing_skills)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001
        print("ERROR:", exc)
        sys.exit(1)
