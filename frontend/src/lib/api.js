// Thin client for the FastAPI compute service + the baked demo dataset.
import { supabase } from './supabase'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8099'

async function json(res) {
  if (!res.ok) {
    let detail = ''
    try { detail = (await res.json())?.detail || '' } catch { /* not json */ }
    throw new Error(detail || `${res.status} ${res.statusText}`)
  }
  return res.json()
}

// Attach the signed-in user's Supabase JWT so the backend can authorise admin ops.
async function authHeaders() {
  if (!supabase) return {}
  const { data } = await supabase.auth.getSession()
  const t = data?.session?.access_token
  return t ? { Authorization: `Bearer ${t}` } : {}
}

export const api = {
  base: API,

  health: () => fetch(`${API}/health`).then(json),

  companies: () => fetch(`${API}/companies`).then(json).then((d) => d.companies),

  companiesUniverse: () => fetch(`${API}/companies-universe`).then(json).then((d) => d.rows),

  parseResume(file) {
    const fd = new FormData()
    fd.append('file', file)
    return fetch(`${API}/parse/resume`, { method: 'POST', body: fd }).then(json)
  },

  parseJD(file) {
    const fd = new FormData()
    fd.append('file', file)
    return fetch(`${API}/parse/jd`, { method: 'POST', body: fd }).then(json)
  },

  talentCheck(profile, company, companyBar) {
    return fetch(`${API}/talent-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, company, company_bar: companyBar || null }),
    }).then(json)
  },

  skillMatch(profile, jd) {
    return fetch(`${API}/skill-match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, jd }),
    }).then(json)
  },

  /* -------- admin (service-role, requires an admin JWT) -------- */
  async adminOverview() {
    return fetch(`${API}/admin/overview`, { headers: await authHeaders() }).then(json)
  },

  async adminAddCandidate(payload) {
    return fetch(`${API}/admin/candidates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify(payload),
    }).then(json)
  },

  async adminDeleteCandidate(userId) {
    return fetch(`${API}/admin/candidates/${userId}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    }).then(json)
  },
}

// Precomputed sample data (parsed JDs/resumes + scores) baked by make_demo_data.py
export const loadDemo = () => fetch('/demo_data.json').then(json)
