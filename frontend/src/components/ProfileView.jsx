import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { hasSupabase } from '../lib/supabase'
import * as db from '../lib/db'
import { catColor, catName, SKILLSET_CODES, CATEGORIES, matchLabel } from '../lib/skills'
import Gauge from './Gauge'
import Icon from './Icon'

const empty = {
  name: '', email: '', education: '', skills: [],
  hackathons: [], internships: [], certifications: [], preferred_roles: [], cv_file: '',
}

export default function ProfileView({ companies, jds, onSignIn }) {
  const { user } = useAuth()
  const [p, setP] = useState(empty)
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState('')
  const [toast, setToast] = useState('')
  const fileRef = useRef()

  // check state
  const [company, setCompany] = useState('')
  const [jdIdx, setJdIdx] = useState(0)
  const [tc, setTc] = useState(null)
  const [sm, setSm] = useState(null)

  useEffect(() => {
    if (companies?.length && !company) setCompany(companies[0].name)
  }, [companies])

  useEffect(() => {
    if (hasSupabase && user) {
      db.loadMyProfile(user.id).then((row) => { if (row) setP({ ...empty, ...row }) }).catch(() => {})
    }
  }, [user])

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  async function onFile(f) {
    if (!f) return
    setFile(f); setBusy('Parsing résumé with AI…')
    try {
      const res = await api.parseResume(f)
      setP((prev) => ({
        ...prev,
        name: res.name || prev.name,
        education: res.education || prev.education,
        skills: res.skills?.length ? res.skills : prev.skills,
        preferred_roles: res.role ? [res.role] : prev.preferred_roles,
      }))
      flash(`Extracted ${res.skills?.length || 0} skills`)
    } catch (e) { flash('Parse failed — is the backend running?') }
    finally { setBusy('') }
  }

  async function save() {
    if (!hasSupabase || !user) { onSignIn(); return }
    setBusy('Saving profile…')
    try {
      let cvPath = p.cv_file
      if (file) cvPath = await db.uploadCV(user.id, file)
      await db.saveMyProfile(user.id, { ...p, cv_file: cvPath })
      setP((prev) => ({ ...prev, cv_file: cvPath }))
      flash('Profile saved to Supabase')
    } catch (e) { flash('Save failed: ' + e.message) }
    finally { setBusy('') }
  }

  async function runTalentCheck() {
    setBusy('Running Talent Check…')
    try {
      const r = await api.talentCheck(p, company)
      setTc(r)
      if (hasSupabase && user) db.saveTalentCheck(user.id, r).catch(() => {})
    } catch (e) { flash('Talent Check failed') } finally { setBusy('') }
  }

  async function runSkillMatch() {
    setBusy('Running Skill Match…')
    try {
      const r = await api.skillMatch(p, jds[jdIdx])
      setSm(r)
      if (hasSupabase && user) db.saveSkillMatch(user.id, r).catch(() => {})
    } catch (e) { flash('Skill Match failed') } finally { setBusy('') }
  }

  const removeSkill = (i) => setP({ ...p, skills: p.skills.filter((_, x) => x !== i) })

  return (
    <div className="profile">
      {toast && <div className="toast">{toast}</div>}

      <div className="pcols">
        {/* ---------- left: profile builder ---------- */}
        <div className="pcard">
          <h2>Your profile</h2>
          <div className="drop" onClick={() => fileRef.current?.click()}>
            <input ref={fileRef} type="file" accept=".pdf,.docx" hidden
              onChange={(e) => onFile(e.target.files[0])} />
            <b><Icon name="upload" size={16} /> Upload résumé (PDF/DOCX)</b>
            <span>{file ? file.name : 'AI auto-fills your skills & details'}</span>
          </div>

          <div className="grid2">
            <Field label="Name" value={p.name} onChange={(v) => setP({ ...p, name: v })} />
            <Field label="Email" value={p.email} onChange={(v) => setP({ ...p, email: v })} />
          </div>
          <Field label="Education" value={p.education} onChange={(v) => setP({ ...p, education: v })} />
          <Field label="Preferred roles (comma-separated)"
            value={(p.preferred_roles || []).join(', ')}
            onChange={(v) => setP({ ...p, preferred_roles: v.split(',').map((s) => s.trim()).filter(Boolean) })} />

          <label className="flab">Skills ({p.skills.length})</label>
          <div className="chips-wrap">
            {p.skills.map((s, i) => (
              <span className="skill-chip" key={i} style={{ borderColor: catColor(s.category_code) }}>
                <i style={{ background: catColor(s.category_code) }} />{s.skill_name}
                <b onClick={() => removeSkill(i)}><Icon name="x" size={11} /></b>
              </span>
            ))}
            {p.skills.length === 0 && <span className="muted">Upload a résumé or add skills below</span>}
          </div>
          <AddSkill onAdd={(s) => setP({ ...p, skills: [...p.skills, s] })} />

          <ListField label="Hackathons" value={p.hackathons} onChange={(v) => setP({ ...p, hackathons: v })} />
          <ListField label="Internships" value={p.internships} onChange={(v) => setP({ ...p, internships: v })} />
          <ListField label="Certifications" value={p.certifications} onChange={(v) => setP({ ...p, certifications: v })} />

          <button className="primary wide" onClick={save} disabled={!!busy}>
            {hasSupabase && user ? 'Save profile' : 'Sign in to save'}
          </button>
        </div>

        {/* ---------- right: run checks ---------- */}
        <div className="pcard">
          <h2>Talent Check</h2>
          <p className="muted">How ready is this profile for a company's bar across all 12 skillsets?</p>
          <div className="run-row">
            <select value={company} onChange={(e) => setCompany(e.target.value)}>
              {companies.map((c) => <option key={c.name}>{c.name}</option>)}
            </select>
            <button className="primary" onClick={runTalentCheck} disabled={!!busy || !p.skills.length}>Run</button>
          </div>
          {tc && (
            <div className="tc-result">
              <div className="tc-top">
                <Gauge value={tc.readiness_score} size={96} color="#f5451f" label="Readiness" />
                <div className="muted">against <b>{tc.company}</b></div>
              </div>
              <div className="bars">
                {tc.skillset_gap.filter((g) => SKILLSET_CODES.includes(g.category_code)).map((g) => (
                  <div className="bar-row" key={g.category_code} title={catName(g.category_code)}>
                    <span className="bl">{g.category_code}</span>
                    <div className="track">
                      <div className="req" style={{ width: `${g.required_level * 10}%` }} />
                      <div className="cand" style={{ width: `${g.candidate_level * 10}%`, background: g.gap ? '#e0a23c' : '#6fbf4f' }} />
                    </div>
                    <span className="bv">{g.candidate_level}/{g.required_level}</span>
                  </div>
                ))}
              </div>
              <div className="legend"><span><i className="req" />required bar</span><span><i style={{ background: '#6fbf4f' }} />you meet it</span><span><i style={{ background: '#e0a23c' }} />gap</span></div>
            </div>
          )}

          <h2 style={{ marginTop: 24 }}>Skill Match</h2>
          <p className="muted">How well does this profile match one specific job posting?</p>
          <div className="run-row">
            <select value={jdIdx} onChange={(e) => setJdIdx(Number(e.target.value))}>
              {jds.map((j, i) => <option key={i} value={i}>{j.company} — {j.role}</option>)}
            </select>
            <button className="primary" onClick={runSkillMatch} disabled={!!busy || !p.skills.length}>Run</button>
          </div>
          {sm && (
            <div className="tc-result">
              <div className="tc-top">
                <Gauge value={sm.match_score} size={96} color="#f5451f" label={matchLabel(sm.match_score)} />
                <div className="muted">{sm.company} — {sm.role}</div>
              </div>
              <div className="ms-cols">
                <div>
                  <b className="ok-h"><Icon name="check" size={13} /> Matched ({sm.matched_skills.length})</b>
                  {sm.matched_skills.map((s, i) => <div className="ms-item ok" key={i}>{s}</div>)}
                </div>
                <div>
                  <b className="miss-h"><Icon name="x" size={13} /> Missing ({sm.missing_skills.length})</b>
                  {sm.missing_skills.map((s, i) => <div className="ms-item miss" key={i}>{s}</div>)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {busy && <div className="busy">{busy}</div>}
    </div>
  )
}

/* ---- small inputs ---- */
function Field({ label, value, onChange }) {
  return (
    <div className="field">
      <label className="flab">{label}</label>
      <input value={value || ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function ListField({ label, value, onChange }) {
  return (
    <div className="field">
      <label className="flab">{label} (one per line)</label>
      <textarea rows={2} value={(value || []).join('\n')}
        onChange={(e) => onChange(e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))} />
    </div>
  )
}

function AddSkill({ onAdd }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('COD')
  return (
    <div className="add-skill">
      <input placeholder="Add a skill…" value={name} onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) { onAdd({ skill_name: name.trim(), category_code: code, confidence: 'medium', evidence: 'manually added' }); setName('') } }} />
      <select value={code} onChange={(e) => setCode(e.target.value)}>
        {Object.entries(CATEGORIES).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
      </select>
    </div>
  )
}
