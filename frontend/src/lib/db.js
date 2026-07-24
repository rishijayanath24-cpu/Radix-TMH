// Supabase data-access helpers (candidate profiles, CV storage, JDs, history).
import { supabase } from './supabase'

export async function loadMyProfile(userId) {
  const { data, error } = await supabase
    .from('candidate_profiles').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data
}

export async function saveMyProfile(userId, p) {
  const row = {
    user_id: userId,
    name: p.name || '',
    email: p.email || '',
    education: p.education || '',
    skills: p.skills || [],
    hackathons: p.hackathons || [],
    internships: p.internships || [],
    certifications: p.certifications || [],
    preferred_roles: p.preferred_roles || [],
    cv_file: p.cv_file || '',
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase
    .from('candidate_profiles').upsert(row, { onConflict: 'user_id' }).select().single()
  if (error) throw error
  return data
}

export async function uploadCV(userId, file) {
  const path = `${userId}/${Date.now()}_${file.name}`
  const { error } = await supabase.storage.from('resumes').upload(path, file, { upsert: true })
  if (error) throw error
  return path
}

export async function uploadJDFile(userId, file) {
  const path = `${userId}/${Date.now()}_${file.name}`
  const { error } = await supabase.storage.from('jds').upload(path, file, { upsert: true })
  if (error) throw error
  return path
}

export async function listJDs() {
  const { data, error } = await supabase
    .from('jds').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// Only the JDs a given user posted — the employer view is scoped to these so an
// employer never sees the whole platform's postings, only their own company's.
export async function listJDsByUploader(userId) {
  const { data, error } = await supabase
    .from('jds').select('*').eq('uploaded_by', userId).order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function saveJD(uploadedBy, jd, storagePath) {
  const row = {
    company_name: jd.company || '',
    role: jd.role || '',
    source_file: jd.source_file || '',
    storage_path: storagePath || '',
    skills: jd.skills || [],
    uploaded_by: uploadedBy,
  }
  const { data, error } = await supabase.from('jds').insert(row).select().single()
  if (error) throw error
  return data
}

export async function saveTalentCheck(userId, r) {
  await supabase.from('talent_checks').insert({
    user_id: userId, company_name: r.company,
    readiness_score: r.readiness_score, skillset_gap: r.skillset_gap,
  })
}

export async function saveSkillMatch(userId, r) {
  await supabase.from('skill_matches').insert({
    user_id: userId, jd_source_file: r.jd_source_file, match_score: r.match_score,
    matched_skills: r.matched_skills, missing_skills: r.missing_skills,
  })
}

/* ---------- companies + skillset bars (admin) ---------- */
export async function listCompaniesWithBars() {
  const { data: comps, error: e1 } = await supabase.from('companies').select('id,name').order('name')
  if (e1) throw e1
  const { data: sk, error: e2 } = await supabase
    .from('company_skillsets').select('company_id,category_code,required_level')
  if (e2) throw e2
  return (comps || []).map((c) => ({
    id: c.id,
    name: c.name,
    skillsets: Object.fromEntries(
      (sk || []).filter((s) => s.company_id === c.id).map((s) => [s.category_code, s.required_level])
    ),
  }))
}

export async function updateCompanyBar(companyId, skillsets) {
  const rows = Object.entries(skillsets).map(([category_code, required_level]) => ({
    company_id: companyId, category_code, required_level: Number(required_level),
  }))
  const { error } = await supabase.from('company_skillsets').upsert(rows, { onConflict: 'company_id,category_code' })
  if (error) throw error
}

export async function createCompany(name) {
  const { data, error } = await supabase.from('companies').insert({ name }).select().single()
  if (error) throw error
  return data
}

export async function deleteCompany(companyId) {
  // company_skillsets rows cascade via the FK (on delete cascade).
  const { error } = await supabase.from('companies').delete().eq('id', companyId)
  if (error) throw error
}

// Bulk-import companies + their 12-skillset bars (from the company universe) into
// the app's own tables. Idempotent: upserts by company name, then by
// (company_id, category_code). Chunked so large imports don't hit payload limits.
export async function bulkUpsertCompaniesWithBars(list) {
  if (!list?.length) return { companies: 0, bars: 0 }
  // 1) upsert companies by unique name, get their ids back
  const { data: comps, error } = await supabase
    .from('companies')
    .upsert(list.map((c) => ({ name: c.name })), { onConflict: 'name' })
    .select('id,name')
  if (error) throw error
  const idByName = Object.fromEntries((comps || []).map((c) => [c.name, c.id]))

  // 2) build all skillset rows
  const rows = []
  for (const c of list) {
    const id = idByName[c.name]
    if (!id) continue
    for (const [category_code, required_level] of Object.entries(c.bar || {})) {
      rows.push({ company_id: id, category_code, required_level: Number(required_level) })
    }
  }
  // 3) chunked upsert
  let bars = 0
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    const { error: e2 } = await supabase
      .from('company_skillsets').upsert(chunk, { onConflict: 'company_id,category_code' })
    if (e2) throw e2
    bars += chunk.length
  }
  return { companies: (comps || []).length, bars }
}

/* ---------- users (admin) ---------- */
export async function listUsers() {
  const { data, error } = await supabase
    .from('profiles').select('id,email,full_name,role,created_at').order('created_at')
  if (error) throw error
  return data || []
}

export async function updateUserRole(id, role) {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
  if (error) throw error
}

// Live counts of every registered user by role (admin RLS lets admins read all
// profiles). Used for the always-up-to-date registration tallies in the console.
export async function countUsersByRole() {
  const { data, error } = await supabase.from('profiles').select('role')
  if (error) throw error
  const by = { candidate: 0, employer: 0, admin: 0 }
  for (const r of data || []) by[r.role] = (by[r.role] || 0) + 1
  return { total: (data || []).length, ...by }
}

/* ---------- candidates (employer/admin) ---------- */
export async function listCandidates() {
  const { data, error } = await supabase
    .from('candidate_profiles')
    .select('user_id,name,email,education,skills,preferred_roles,cv_file')
  if (error) throw error
  return data || []
}
