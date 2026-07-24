"""
Admin-only endpoints (service-role) — the few operations RLS can't grant the
browser: creating and deleting candidate *auth users*. Everything else (company
CRUD, role changes, reads) the React app does directly against Supabase.

Guarding: the caller sends their Supabase access token as `Authorization: Bearer
<jwt>`. We resolve it to a user with the service client and confirm that user's
profile role is 'admin' before doing anything.

Needs SUPABASE_URL + SUPABASE_SERVICE_KEY in backend/.env (the service_role
secret). If they're absent the routes return 503 and the rest of the API is
unaffected.
"""

from __future__ import annotations

import os
from collections import Counter

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

URL = os.getenv("SUPABASE_URL")
KEY = os.getenv("SUPABASE_SERVICE_KEY")

try:
    from supabase import create_client
    _sb = create_client(URL, KEY) if URL and KEY else None
except Exception:  # supabase lib missing / bad config — routes will 503
    _sb = None

router = APIRouter(prefix="/admin", tags=["admin"])

DEFAULT_PW = "radixdemo123"


def _require_admin(authorization: str | None) -> str:
    """Validate the bearer token and confirm the caller is an admin. Returns uid."""
    if _sb is None:
        raise HTTPException(503, "Supabase service key not configured on the server")
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    try:
        res = _sb.auth.get_user(token)
        uid = res.user.id
    except Exception:
        raise HTTPException(401, "Invalid or expired token")
    try:
        prof = _sb.table("profiles").select("role").eq("id", uid).single().execute()
    except Exception:
        raise HTTPException(403, "No profile for this user")
    if not prof.data or prof.data.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return uid


class NewCandidate(BaseModel):
    name: str
    email: str
    password: str | None = None
    education: str | None = ""
    skills: list = []
    preferred_roles: list = []


@router.get("/overview")
def overview(authorization: str | None = Header(default=None)):
    """Authoritative, always-fresh platform tallies (bypasses RLS via service key)."""
    _require_admin(authorization)
    profs = _sb.table("profiles").select("role").execute().data or []
    by = Counter((p.get("role") or "candidate") for p in profs)
    cps = _sb.table("candidate_profiles").select("user_id").execute().data or []
    comps = _sb.table("companies").select("id").execute().data or []
    jds = _sb.table("jds").select("id").execute().data or []
    return {
        "users_total": len(profs),
        "by_role": {
            "candidate": by.get("candidate", 0),
            "employer": by.get("employer", 0),
            "admin": by.get("admin", 0),
        },
        "candidate_profiles": len(cps),
        "companies": len(comps),
        "jds": len(jds),
    }


@router.post("/candidates")
def add_candidate(body: NewCandidate, authorization: str | None = Header(default=None)):
    """Create an auto-confirmed candidate auth user + their profile rows."""
    _require_admin(authorization)
    email = (body.email or "").strip().lower()
    if not email or "@" not in email:
        raise HTTPException(400, "A valid email is required")
    try:
        res = _sb.auth.admin.create_user({
            "email": email,
            "password": body.password or DEFAULT_PW,
            "email_confirm": True,  # no confirmation email → no rate limit
            "user_metadata": {"full_name": body.name, "role": "candidate"},
        })
        uid = res.user.id
    except Exception as e:
        raise HTTPException(400, f"Could not create user (already exists?): {e}")
    # the on-signup trigger creates the profile; upsert makes name/role certain.
    _sb.table("profiles").upsert(
        {"id": uid, "email": email, "full_name": body.name, "role": "candidate"},
        on_conflict="id",
    ).execute()
    _sb.table("candidate_profiles").upsert({
        "user_id": uid, "name": body.name, "email": email,
        "education": body.education or "", "skills": body.skills or [],
        "preferred_roles": body.preferred_roles or [],
    }, on_conflict="user_id").execute()
    return {"user_id": uid, "name": body.name, "email": email}


@router.delete("/candidates/{user_id}")
def delete_candidate(user_id: str, authorization: str | None = Header(default=None)):
    """Delete the auth user; profile + candidate_profile cascade via FK."""
    _require_admin(authorization)
    try:
        _sb.auth.admin.delete_user(user_id)
    except Exception as e:
        raise HTTPException(400, f"Could not delete user: {e}")
    return {"ok": True, "user_id": user_id}
