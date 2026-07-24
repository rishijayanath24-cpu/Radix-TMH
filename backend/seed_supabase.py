"""
Seed Supabase with ALL sample data.

What it creates (idempotent — safe to run more than once):
  1. 3 demo login accounts: candidate@ / employer@ / admin@radix.demo  (pw: radixdemo123)
  2. 4 sample candidate USERS + their parsed candidate_profiles (populates the pool)
  3. the 6 parsed JDs (owned by the employer account)
Companies + 12-skillset bars are already seeded by supabase/migration.sql.

Requirements:
  - You've run supabase/migration.sql in the SQL editor (tables must exist).
  - backend/.env has SUPABASE_URL and SUPABASE_SERVICE_KEY (the *service_role* secret,
    from Supabase → Project Settings → API). The service key bypasses RLS and can
    create auto-confirmed users (no emails sent → no rate limit).

Run from backend/:  python seed_supabase.py
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / "backend" / ".env")

URL = os.getenv("SUPABASE_URL")
KEY = os.getenv("SUPABASE_SERVICE_KEY")
if not URL or not KEY:
    sys.exit(
        "ERROR: set SUPABASE_URL and SUPABASE_SERVICE_KEY in backend/.env.\n"
        "Get the service_role key from Supabase → Project Settings → API → 'service_role' (secret)."
    )

from supabase import create_client

sb = create_client(URL, KEY)

DEMO_PATH = ROOT / "frontend" / "public" / "demo_data.json"
if not DEMO_PATH.exists():
    sys.exit("ERROR: frontend/public/demo_data.json missing — run `python make_demo_data.py` first.")
demo = json.loads(DEMO_PATH.read_text(encoding="utf-8"))

PW = "radixdemo123"
LOGIN_ACCOUNTS = [
    ("candidate@radix.demo", "Demo Candidate", "candidate"),
    ("employer@radix.demo", "Demo Employer", "employer"),
    ("admin@radix.demo", "Demo Admin", "admin"),
]


def _all_users():
    res = sb.auth.admin.list_users()
    return getattr(res, "users", res) or []


def _find_user(email: str):
    for u in _all_users():
        if (getattr(u, "email", "") or "").lower() == email.lower():
            return u.id
    return None


def ensure_user(email: str, full_name: str, role: str, password: str = PW) -> str:
    """Create an auto-confirmed user if missing; ensure profile role. Returns user id."""
    uid = _find_user(email)
    if uid is None:
        res = sb.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,   # no confirmation email → no rate limit
            "user_metadata": {"full_name": full_name, "role": role},
        })
        uid = res.user.id
        print(f"  + created {email:28s} ({role})")
    else:
        print(f"  = exists  {email:28s} ({role})")
    # the on-signup trigger creates the profile row; make sure role/name are right
    sb.table("profiles").update({"role": role, "full_name": full_name}).eq("id", uid).execute()
    return uid


def slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", ".", (name or "").lower()).strip(".")
    return s or "candidate"


def main() -> None:
    print("1) Demo login accounts")
    ids = {role: ensure_user(email, name, role) for email, name, role in LOGIN_ACCOUNTS}

    print("\n2) Sample candidate users + profiles")
    for i, c in enumerate(demo.get("candidates", [])):
        p = c.get("profile", {})
        name = p.get("name") or f"Candidate {i + 1}"
        email = f"{slugify(name)}@radix.demo"
        uid = ensure_user(email, name, "candidate")
        sb.table("candidate_profiles").upsert({
            "user_id": uid, "name": name, "email": email,
            "education": p.get("education", ""), "skills": p.get("skills", []),
            "hackathons": p.get("hackathons", []), "internships": p.get("internships", []),
            "certifications": p.get("certifications", []), "preferred_roles": p.get("preferred_roles", []),
            "cv_file": "",
        }, on_conflict="user_id").execute()
        print(f"     profile saved: {name} ({len(p.get('skills', []))} skills)")

    # give the demo candidate login a ready-made profile (first sample)
    if demo.get("candidates"):
        p0 = demo["candidates"][0]["profile"]
        sb.table("candidate_profiles").upsert({
            "user_id": ids["candidate"], "name": p0.get("name", "Demo Candidate"),
            "email": "candidate@radix.demo", "education": p0.get("education", ""),
            "skills": p0.get("skills", []), "preferred_roles": p0.get("preferred_roles", []),
        }, on_conflict="user_id").execute()

    print("\n3) JDs (owned by the employer account)")
    files = [jd.get("source_file", "") for jd in demo.get("jds", [])]
    sb.table("jds").delete().in_("source_file", files).execute()   # idempotent re-seed
    for jd in demo.get("jds", []):
        sb.table("jds").insert({
            "company_name": jd.get("company", ""), "role": jd.get("role", ""),
            "source_file": jd.get("source_file", ""), "skills": jd.get("skills", []),
            "uploaded_by": ids["employer"],
        }).execute()
        print(f"     JD: {jd.get('company')} — {jd.get('role')} ({len(jd.get('skills', []))} skills)")

    print("\nDone. Sign in with candidate@ / employer@ / admin@radix.demo  (password: radixdemo123)")


if __name__ == "__main__":
    main()
