"""
RADIX Talent Match — FastAPI service.

Stateless compute layer: it parses documents and runs the matching/scoring.
Auth, persistence and file storage are handled by the React app talking to
Supabase directly (keeps row-level security simple). This service just turns
files + JSON into structured results.

Run:  uvicorn app.main:app --reload --port 8000   (from the backend/ folder)
"""

from __future__ import annotations

import os

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from . import companies, llm
from .admin import router as admin_router
from .companies_universe import router as companies_universe_router
from .extract import analyze_jd, analyze_resume, extract_text
from .match import profile_from_resume, skill_match, talent_check
from .models import (
    ExtractedSkillList,
    SkillMatchRequest,
    SkillMatchResult,
    TalentCheckRequest,
    TalentCheckResult,
)

app = FastAPI(title="RADIX Talent Match API", version="1.0.0")

_origins = [
    os.getenv("FRONTEND_ORIGIN", "http://localhost:5173"),
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(dict.fromkeys(_origins)),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(admin_router)
app.include_router(companies_universe_router)


@app.get("/")
def root():
    return {"service": "RADIX Talent Match API", "docs": "/docs"}


@app.get("/health")
def health():
    return {
        "status": "ok",
        "llm": llm.provider_status(),
        "companies_loaded": len(companies.list_companies()),
    }


@app.get("/companies")
def get_companies():
    """Company list + their 12-skillset bars (for the Talent Check dropdown)."""
    return {"companies": companies.list_companies()}


@app.post("/parse/jd", response_model=ExtractedSkillList)
async def parse_jd(file: UploadFile = File(...)):
    data = await file.read()
    text = extract_text(file.filename or "jd.pdf", data)
    return analyze_jd(text, source_file=file.filename or "")


@app.post("/parse/resume", response_model=ExtractedSkillList)
async def parse_resume(file: UploadFile = File(...)):
    data = await file.read()
    text = extract_text(file.filename or "resume.pdf", data)
    return analyze_resume(text, source_file=file.filename or "")


@app.post("/talent-check", response_model=TalentCheckResult)
def run_talent_check(req: TalentCheckRequest):
    bar = req.company_bar or companies.get_bar(req.company)
    return talent_check(req.profile, req.company, bar)


@app.post("/skill-match", response_model=SkillMatchResult)
def run_skill_match(req: SkillMatchRequest):
    return skill_match(req.profile, req.jd)
