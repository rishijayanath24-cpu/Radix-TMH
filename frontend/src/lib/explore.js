// Company universe (116 companies) from the intelligence DB + a Talent-Check
// scorer that mirrors the backend exactly, so "Explore Companies" can rank every
// company against a candidate instantly, client-side (no 116 round-trips).
import { api } from './api'
import { SKILLSET_CODES } from './skills'

// staging_company_skill_levels column  ->  our 12 category codes
const COLS = {
  coding: 'COD',
  data_structures_and_algorithms: 'DSA',
  object_oriented_programming_and_design: 'OOD',
  aptitude_and_problem_solving: 'APTI',
  communication_skills: 'COMM',
  ai_native_engineering: 'AI',
  devops_and_cloud: 'CLOUD',
  sql_and_design: 'SQL',
  software_engineering: 'SWE',
  system_design_and_architecture: 'SYSD',
  computer_networking: 'NETW',
  operating_system: 'OS',
}

// proficiency code -> human label (secondary qualitative tag on each bar)
export const PROF_NAME = {
  CU: 'Conceptual Understanding',
  AP: 'Application',
  AS: 'Analysis & Synthesis',
  EV: 'Evaluation',
  CR: 'Creation',
}

// each cell looks like "8-CR" = required level 8, proficiency "Creation"
function parseCell(v) {
  const m = /^\s*(\d+)\s*-\s*([A-Za-z]+)/.exec(String(v ?? ''))
  if (!m) return { level: 0, prof: '' }
  return { level: Math.max(0, Math.min(10, parseInt(m[1], 10))), prof: m[2].toUpperCase() }
}

// Load + normalise the whole universe into [{ id, name, bar:{CODE:level}, prof:{CODE:code} }].
export async function loadCompanyUniverse() {
  const data = await api.companiesUniverse().catch(() => [])
  const seen = new Set()
  const out = []
  for (const r of data || []) {
    const name = (r.companies || '').trim()
    if (!name || seen.has(name.toLowerCase())) continue   // dedup by name
    seen.add(name.toLowerCase())
    const bar = {}, prof = {}
    for (const [col, code] of Object.entries(COLS)) {
      const { level, prof: pc } = parseCell(r[col])
      bar[code] = level
      prof[code] = pc
    }
    out.push({ id: r.id, name, bar, prof })
  }
  out.sort((a, b) => a.name.localeCompare(b.name))
  return out
}

/* ---- scoring: mirrors backend match.py talent_check() EXACTLY ----
   Keep these knobs in sync with backend/app/match.py (CONF_POINTS, LEVEL_SCALE). */
const CONF_POINTS = { high: 3, medium: 2, low: 1 }
const LEVEL_SCALE = 1.5

// Derive the candidate's 1-10 competency per skillset from their profile skills.
export function candidateLevels(skills = []) {
  const lv = {}
  for (const code of SKILLSET_CODES) {
    const pts = skills
      .filter((s) => s.category_code === code)
      .reduce((a, s) => a + (CONF_POINTS[s.confidence] || 1), 0)
    lv[code] = pts <= 0 ? 0 : Math.max(1, Math.min(10, Math.round(pts * LEVEL_SCALE)))
  }
  return lv
}

// Readiness (0-100): how much of the company's required bar the candidate covers,
// naturally weighted by how demanding each skillset's bar is.
export function readiness(levels, bar) {
  let req = 0, cov = 0
  for (const code of SKILLSET_CODES) {
    const r = bar[code] || 0
    if (r > 0) { req += r; cov += Math.min(levels[code] || 0, r) }
  }
  return req ? Math.round((100 * cov) / req) : 0
}

/* ---- market helpers (benchmarks + bar seeding) ---- */

// Average required level per skillset across the whole universe (floats).
export function marketAverageBar(universe = []) {
  const out = {}
  const n = Math.max(1, universe.length)
  for (const code of SKILLSET_CODES) {
    out[code] = universe.reduce((a, c) => a + (c.bar[code] || 0), 0) / n
  }
  return out
}

const _norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// Fuzzy-match a company name to a universe entry (exact → substring → token overlap).
export function findUniverseCompany(universe = [], name) {
  if (!name) return null
  const q = _norm(name)
  let hit = universe.find((c) => _norm(c.name) === q)
  if (hit) return hit
  hit = universe.find((c) => { const n = _norm(c.name); return n && (n.includes(q) || q.includes(n)) })
  if (hit) return hit
  const qt = new Set(q.split(' ').filter(Boolean))
  let best = null, score = 0
  for (const c of universe) {
    const overlap = _norm(c.name).split(' ').filter(Boolean).filter((t) => qt.has(t)).length
    if (overlap > score) { best = c; score = overlap }
  }
  return score >= 1 ? best : null
}

// Derive a 0-10 "demand bar" from a set of JDs (confidence-weighted, scaled to the
// most-demanded skillset). Lets an employer seed a target from their own postings.
export function barFromJDs(jds = []) {
  const W = { high: 3, medium: 2, low: 1 }
  const raw = {}
  for (const code of SKILLSET_CODES) raw[code] = 0
  for (const jd of jds) for (const s of jd.skills || []) {
    if (raw[s.category_code] != null) raw[s.category_code] += W[s.confidence] || 1
  }
  const max = Math.max(1, ...SKILLSET_CODES.map((c) => raw[c]))
  const out = {}
  for (const code of SKILLSET_CODES) out[code] = Math.round((raw[code] / max) * 10)
  return out
}

// Round a float bar to integers (e.g. market average → a usable 0-10 bar).
export function roundBar(bar) {
  const out = {}
  for (const code of SKILLSET_CODES) out[code] = Math.round(bar[code] || 0)
  return out
}
