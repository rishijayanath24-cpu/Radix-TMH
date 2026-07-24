"""
Talent Check + Skill Matching (plain, explainable, deterministic logic).

Talent Check  -> profile vs a company's 12-skillset bar -> readiness_score + gaps
Skill Match   -> profile vs one JD's skill list         -> match_score + matched/missing

Both are pure Python (no LLM needed): more reliable and trivially debuggable,
exactly as the brief recommends.
"""

from __future__ import annotations

import re

from rapidfuzz import fuzz

from .models import (
    CandidateProfile,
    ExtractedSkillList,
    Skill,
    SkillMatchResult,
    SkillsetGap,
    TalentCheckResult,
)
from .taxonomy import ALIASES, SKILLSET_CODES, category_name

# ---- tunable knobs (kept together so scoring is easy to calibrate) ----
CONF_POINTS = {"high": 3.0, "medium": 2.0, "low": 1.0}
LEVEL_SCALE = 1.5          # points -> 1..10 level multiplier
EXACT_FUZZ = 88            # >= this token_set_ratio counts as a match (any category)
SAME_CAT_FUZZ = 72         # >= this counts as a match when categories agree


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _norm(name: str) -> str:
    """Normalise a skill name for comparison (lowercase, alias, strip noise)."""
    s = (name or "").lower().strip()
    s = re.sub(r"[()\[\]]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return ALIASES.get(s, s)


def _round(x: float) -> int:
    return int(x + 0.5)


def _candidate_level(skills: list[Skill], code: str) -> int:
    """Derive a 1-10 competency level for one category from the profile skills."""
    pts = sum(CONF_POINTS.get(s.confidence, 1.0) for s in skills if s.category_code == code)
    if pts <= 0:
        return 0
    return max(1, min(10, _round(pts * LEVEL_SCALE)))


# ---------------------------------------------------------------------------
# Talent Check
# ---------------------------------------------------------------------------

def talent_check(
    profile: CandidateProfile,
    company: str,
    company_bar: dict[str, int],
) -> TalentCheckResult:
    """
    company_bar: {category_code: required_level(1-10)} for the selected company.
    readiness = how much of the required bar the candidate covers (0-100),
    weighted naturally by how demanding each skillset's bar is.
    """
    gaps: list[SkillsetGap] = []
    total_required = 0
    total_covered = 0

    for code in SKILLSET_CODES:
        required = int(company_bar.get(code, 0))
        cand = _candidate_level(profile.skills, code)
        if required > 0:
            total_required += required
            total_covered += min(cand, required)
        gaps.append(
            SkillsetGap(
                category_code=code,
                category_name=category_name(code),
                required_level=required,
                candidate_level=cand,
                gap=cand < required,
            )
        )

    readiness = _round(100 * total_covered / total_required) if total_required else 0
    return TalentCheckResult(company=company, skillset_gap=gaps, readiness_score=readiness)


# ---------------------------------------------------------------------------
# Skill Matching (one specific JD)
# ---------------------------------------------------------------------------

def skill_match(profile: CandidateProfile, jd: ExtractedSkillList) -> SkillMatchResult:
    cand = profile.skills
    cand_norm = {_norm(s.skill_name): s for s in cand}
    # categories the candidate demonstrates at all (OTHER excluded — too generic)
    cand_categories = {s.category_code for s in cand if s.category_code != "OTHER"}

    matched: list[str] = []
    missing: list[str] = []
    weight_total = 0.0
    weight_matched = 0.0

    for req in jd.skills:
        w = CONF_POINTS.get(req.confidence, 1.0)
        weight_total += w
        if _has_match(req, cand, cand_norm, cand_categories):
            matched.append(req.skill_name)
            weight_matched += w
        else:
            missing.append(req.skill_name)

    score = _round(100 * weight_matched / weight_total) if weight_total else 0
    return SkillMatchResult(
        jd_source_file=jd.source_file,
        company=jd.company,
        role=jd.role,
        match_score=score,
        matched_skills=matched,
        missing_skills=missing,
    )


def _has_match(
    req: Skill,
    cand: list[Skill],
    cand_norm: dict[str, Skill],
    cand_categories: set[str],
) -> bool:
    rn = _norm(req.skill_name)
    # 1) exact (normalised) name hit
    if rn in cand_norm:
        return True
    # 2) fuzzy name hit against any candidate skill
    for cs in cand:
        cn = _norm(cs.skill_name)
        ratio = fuzz.token_set_ratio(rn, cn)
        if ratio >= EXACT_FUZZ:
            return True
        if cs.category_code == req.category_code and ratio >= SAME_CAT_FUZZ:
            return True
    # 3) category-level coverage: an abstract JD skill like "Coding" (COD) is
    #    satisfied when the candidate has ANY concrete skill in that category
    #    (e.g. C++/Python/Java). OTHER is excluded — too generic to be meaningful.
    if req.category_code != "OTHER" and req.category_code in cand_categories:
        return True
    return False


# ---------------------------------------------------------------------------
# convenience: profile <- resume extraction (pre-fill Profile Builder)
# ---------------------------------------------------------------------------

def profile_from_resume(res: ExtractedSkillList) -> CandidateProfile:
    return CandidateProfile(
        name=res.name,
        education=res.education,
        skills=res.skills,
        preferred_roles=[res.role] if res.role else [],
    )
