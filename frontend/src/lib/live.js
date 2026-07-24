// Live Supabase data (companies + candidate pool), shaped EXACTLY like the baked
// demo dataset so admin adds/deletes and new registrations reflect everywhere:
// every KPI, panel and analytics chart reads the merged result, not the frozen JSON.
import { api } from './api'
import * as db from './db'

// Compute one candidate's matches + talent_checks against the live JDs/companies,
// producing the same {source_file, profile, matches, talent_checks} shape the
// dashboard already understands. Never throws — a compute failure (e.g. backend
// down) still yields the candidate with empty matches so counts stay correct.
async function computeCandidate(row, jds, companies) {
  const profile = {
    name: row.name, email: row.email, education: row.education,
    skills: row.skills || [], preferred_roles: row.preferred_roles || [],
  }
  try {
    const [matches, talent_checks] = await Promise.all([
      Promise.all(jds.map((jd) => api.skillMatch(profile, jd)))
        .then((m) => m.sort((a, b) => b.match_score - a.match_score)),
      Promise.all(companies.map((c) => api.talentCheck(profile, c.name, c.skillsets))),
    ])
    return { source_file: row.email || row.name, user_id: row.user_id, profile, matches, talent_checks }
  } catch {
    return { source_file: row.email || row.name, user_id: row.user_id, profile, matches: [], talent_checks: [] }
  }
}

// Fetch live companies (+ bars) and the candidate pool, computing live matches so
// the pool drives analytics. JDs stay the baked set (companies + candidates are
// the moving parts). Returns null-safe empty arrays on any read failure.
export async function loadLiveData(jds = []) {
  const [companies, candidateRows] = await Promise.all([
    db.listCompaniesWithBars().catch(() => []),
    db.listCandidates().catch(() => []),
  ])
  // Only candidates who've actually built a profile (have skills) get scored and
  // shown in the match visuals; the rest still count as registered candidates.
  const scorable = (candidateRows || []).filter((c) => (c.skills || []).length)
  const candidates = await Promise.all(
    scorable.map((c) => computeCandidate(c, jds, companies))
  )
  return {
    companies: companies || [],          // [{ id, name, skillsets }]
    candidates,                          // demo-shaped, with live match scores
    candidateRows: candidateRows || [],  // raw rows for the admin management list
  }
}
