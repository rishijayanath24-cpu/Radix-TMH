# RADIX Talent Match

An end-to-end tool that tells a candidate **how ready they are for a specific job**,
built on RADIX's 12-skillset framework. Upload a JD or résumé, build a profile,
and run **Talent Check** (vs a company's bar) and **Skill Match** (vs one JD).

All 5 hackathon modules, one integrated app:

| # | Module | Where it lives |
|---|--------|----------------|
| 1 | JD Analytics | `backend/app/extract.py` → `analyze_jd()` (LLM) |
| 2 | Résumé Parsing | `backend/app/extract.py` → `analyze_resume()` (LLM) |
| 3 | Profile Builder | `frontend/src/components/ProfileView.jsx` + Supabase |
| 4 | Talent Check | `backend/app/match.py` → `talent_check()` |
| 5 | Skill Matching | `backend/app/match.py` → `skill_match()` |

## Architecture
```
React (Vite)  ──HTTP──▶  FastAPI (Python)        Supabase
:5173                    :8099                    (auth · DB · storage)
  │                        │                         ▲
  │  parse / match calls   │  Groq LLM (extraction)  │  profiles, JDs,
  └────────────────────────┘                         │  company bars, history
        │                                             │
        └──────────── auth / data / files ────────────┘
```
- **LLM** is provider-agnostic (`backend/app/llm.py`): Groq (default), OpenAI, Grok, Anthropic, or a local fallback — switch with `LLM_PROVIDER`.
- Scoring is plain, explainable Python. The "what is ready" knobs live at the top of `match.py`.

## Prerequisites
- Python 3.11+ and Node 18+
- A free Groq API key (https://console.groq.com/keys) — or set `LLM_PROVIDER=local`
- A Supabase project (free tier) — only needed for login/saving; the demo runs without it

## Setup

### 1. Backend
```bash
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # Windows
# cp .env.example .env  and fill in GROQ_API_KEY  (already set for this repo)
```

### 2. Supabase (optional, for auth) — see `supabase/README_SUPABASE.md`
- Run `supabase/migration.sql` in the SQL editor.
- Put your project URL + anon key in `frontend/.env`.
- Turn OFF email confirmation for smooth demo signups.

### 3. Frontend
```bash
cd frontend
npm install
# cp .env.example .env  and fill in VITE_SUPABASE_* (already set for this repo)
```

## Run (two terminals)
```bash
# terminal 1 — backend
cd backend && .venv/Scripts/python -m uvicorn app.main:app --port 8099

# terminal 2 — frontend
cd frontend && npm run dev
```
Open **http://localhost:5173**. The dashboard works immediately in demo mode.

> Ports: backend **8099**, frontend **5173**. (8000/8077 were occupied on the dev machine.)

## Regenerate the baked demo data
```bash
cd backend && .venv/Scripts/python make_demo_data.py    # writes frontend/public/demo_data.json
```

## 5-minute demo script
1. **Open the dashboard** — "AI engine live" banner shows Groq is wired. Switch the
   *Viewing as* dropdown across the 4 sample candidates: cards, gauges, and the
   Talent Check panel all recompute. Ananya (systems) tops out on Google **SWE 88%**;
   Karthik (data) on Microsoft **Data Analyst 86%** — scores are *not* constant.
2. **Build a profile** (My Profile) — upload a résumé PDF; AI auto-fills skills.
   Sign in, click **Save**.
3. **Talent Check** — pick a company → readiness score + per-skillset gap bars.
4. **Skill Match** — pick a JD → match score + matched/missing skill lists.
5. **Employer** (Hire) — upload a JD; AI extracts required skills; post it.
6. **Admin** — edit a company's 12-skillset bars; re-run Talent Check to show the
   score move (proves the bars are live, not hardcoded).

## Test the engine standalone
```bash
cd backend && .venv/Scripts/python test_engine.py
```
Prints the full JD/résumé extraction + the Talent Check / Skill Match matrix.
