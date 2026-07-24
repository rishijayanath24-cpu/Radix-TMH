"""
Company-intelligence universe (116 companies + their 12-skillset bars) — a
second, read-only Supabase project, separate from the app's auth/DB.

Proxied through the backend with the service-role key kept server-side only.
Previously the frontend queried this project directly with a service_role
key, which shipped that key inside the browser bundle (bypasses RLS for
anyone who opens devtools). Needs COMPANIES_SUPABASE_URL +
COMPANIES_SUPABASE_SERVICE_KEY in backend/.env; if absent the route 503s and
the rest of the API is unaffected.
"""

from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException

URL = os.getenv("COMPANIES_SUPABASE_URL")
KEY = os.getenv("COMPANIES_SUPABASE_SERVICE_KEY")

try:
    from supabase import create_client
    _sb = create_client(URL, KEY) if URL and KEY else None
except Exception:  # supabase lib missing / bad config — route will 503
    _sb = None

router = APIRouter(prefix="/companies-universe", tags=["companies-universe"])


@router.get("")
def get_universe():
    if _sb is None:
        raise HTTPException(503, "Companies universe DB not configured on the server")
    res = _sb.table("staging_company_skill_levels").select("*").execute()
    return {"rows": res.data or []}
