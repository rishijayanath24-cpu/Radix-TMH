"""
The shared data contract, as Pydantic models.

Mirrors the JSON shapes in the hackathon brief so every module (JD Analytics,
Resume Parsing, Profile Builder, Talent Check, Skill Matching) speaks the same
language. These are also the FastAPI request/response schemas.
"""

from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field

Confidence = Literal["high", "medium", "low"]


class Skill(BaseModel):
    skill_name: str
    category_code: str = "OTHER"          # one of taxonomy.VALID_CODES
    evidence: str = ""                     # short quote / reason
    confidence: Confidence = "medium"


class ExtractedSkillList(BaseModel):
    """Output of JD Analytics or Resume Parsing."""
    source_type: Literal["jd", "resume"]
    source_file: str = ""
    company: str = ""
    role: str = ""
    name: str = ""                          # candidate name (resumes only)
    skills: list[Skill] = Field(default_factory=list)
    # extra structured fields (mostly resumes) — kept optional & tolerant
    education: str = ""
    projects: list[str] = Field(default_factory=list)
    experience: list[str] = Field(default_factory=list)


class CandidateProfile(BaseModel):
    """Output of Profile Builder."""
    name: str = ""
    email: str = ""
    education: str = ""
    skills: list[Skill] = Field(default_factory=list)
    hackathons: list[str] = Field(default_factory=list)
    internships: list[str] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    preferred_roles: list[str] = Field(default_factory=list)
    cv_file: str = ""


class SkillsetGap(BaseModel):
    category_code: str
    category_name: str = ""
    required_level: int = 0        # 1-10
    candidate_level: int = 0       # 1-10
    gap: bool = False


class TalentCheckResult(BaseModel):
    """Output of Talent Check."""
    company: str
    skillset_gap: list[SkillsetGap] = Field(default_factory=list)
    readiness_score: int = 0       # 0-100


class SkillMatchResult(BaseModel):
    """Output of Skill Matching."""
    jd_source_file: str = ""
    company: str = ""
    role: str = ""
    match_score: int = 0           # 0-100
    matched_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)


# ---- request bodies for the compute endpoints ----

class TalentCheckRequest(BaseModel):
    profile: CandidateProfile
    company: str
    # optional: caller-supplied {category_code: required_level} bar.
    # If given, it overrides the local JSON snapshot (e.g. admin-edited bars
    # sourced from Supabase). If omitted, the server looks the company up.
    company_bar: dict[str, int] | None = None


class SkillMatchRequest(BaseModel):
    profile: CandidateProfile
    jd: ExtractedSkillList
