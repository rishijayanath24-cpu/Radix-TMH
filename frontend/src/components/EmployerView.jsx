import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { hasSupabase } from '../lib/supabase'
import * as db from '../lib/db'
import { catColor } from '../lib/skills'
import Icon from './Icon'

export default function EmployerView({ onSignIn, jds = [], company = 'all', onPosted }) {
  const { user, role } = useAuth()
  const [jd, setJd] = useState(null)
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState('')
  const [toast, setToast] = useState('')
  const [candidates, setCandidates] = useState([])
  const fileRef = useRef()

  const canUse = hasSupabase && user && (role === 'employer' || role === 'admin')
  // `jds` are already scoped by App to this employer's own postings for the
  // selected company — this view never shows the whole platform's JDs.
  const myJds = jds
  const scopeLabel = company === 'all' ? 'all your companies' : company

  useEffect(() => {
    if (!canUse) return
    db.listCandidates().then(setCandidates).catch(() => {})
  }, [canUse])

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  async function onFile(f) {
    if (!f) return
    setFile(f); setBusy('Parsing JD with AI…')
    try {
      const parsed = await api.parseJD(f)
      // default the company to the one currently in scope so the new posting
      // lands under the right company.
      if (company !== 'all' && !parsed.company) parsed.company = company
      setJd(parsed); flash('JD parsed')
    }
    catch { flash('Parse failed — is the backend running?') }
    finally { setBusy('') }
  }

  async function saveJd() {
    if (!canUse) { onSignIn(); return }
    setBusy('Saving JD…')
    try {
      const path = file ? await db.uploadJDFile(user.id, file) : ''
      await db.saveJD(user.id, jd, path)
      flash('JD posted')
      setJd(null); setFile(null)
      onPosted?.()
    } catch (e) { flash('Save failed: ' + e.message) }
    finally { setBusy('') }
  }

  if (!canUse) {
    return (
      <Gate onSignIn={onSignIn} loggedIn={!!user} role={role}
        need="employer" title="Employer tools"
        blurb="Post job descriptions and browse the candidate pool." />
    )
  }

  return (
    <div className="profile">
      {toast && <div className="toast">{toast}</div>}
      <div className="pcols">
        <div className="pcard">
          <h2>Post a job description</h2>
          <div className="drop" onClick={() => fileRef.current?.click()}>
            <input ref={fileRef} type="file" accept=".pdf,.docx" hidden onChange={(e) => onFile(e.target.files[0])} />
            <b><Icon name="upload" size={16} /> Upload JD (PDF/DOCX)</b>
            <span>{file ? file.name : 'AI extracts required skills across the 12 skillsets'}</span>
          </div>
          {jd && (
            <div className="tc-result" style={{ borderTop: 0, paddingTop: 0 }}>
              <div className="grid2">
                <div className="field"><label className="flab">Company</label><input value={jd.company} onChange={(e) => setJd({ ...jd, company: e.target.value })} /></div>
                <div className="field"><label className="flab">Role</label><input value={jd.role} onChange={(e) => setJd({ ...jd, role: e.target.value })} /></div>
              </div>
              <label className="flab" style={{ marginTop: 12 }}>Extracted skills ({jd.skills.length})</label>
              <div className="chips-wrap">
                {jd.skills.map((s, i) => (
                  <span className="skill-chip" key={i} style={{ borderColor: catColor(s.category_code) }}>
                    <i style={{ background: catColor(s.category_code) }} />{s.skill_name}
                  </span>
                ))}
              </div>
              <button className="primary wide" onClick={saveJd} disabled={!!busy}>Post this JD</button>
            </div>
          )}
        </div>

        <div className="pcard">
          <h2>Your postings ({myJds.length})</h2>
          <p className="muted" style={{ marginTop: -4 }}>Showing roles for <b>{scopeLabel}</b>.</p>
          <div className="listing">
            {myJds.length === 0 && <p className="muted">No JDs for {scopeLabel} yet — upload one on the left.</p>}
            {myJds.map((j) => (
              <div className="lrow" key={j.id}>
                <div><b>{j.company_name || '—'}</b><span>{j.role}</span></div>
                <span className="pillcount">{(j.skills || []).length} skills</span>
              </div>
            ))}
          </div>

          <h2 style={{ marginTop: 22 }}>Candidate pool ({candidates.length})</h2>
          <div className="listing">
            {candidates.length === 0 && <p className="muted">No candidate profiles saved yet.</p>}
            {candidates.map((c) => (
              <div className="lrow" key={c.user_id}>
                <div><b>{c.name || 'Unnamed'}</b><span>{(c.preferred_roles || []).join(', ') || c.education}</span></div>
                <span className="pillcount">{(c.skills || []).length} skills</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {busy && <div className="busy">{busy}</div>}
    </div>
  )
}

export function Gate({ onSignIn, loggedIn, role, need, title, blurb }) {
  return (
    <div className="gate">
      <h2>{title}</h2>
      <p className="muted">{blurb}</p>
      {!loggedIn ? (
        <button className="primary" onClick={onSignIn}>Sign in as {need}</button>
      ) : (
        <p className="muted">Your account role is <b>{role}</b>. This area needs <b>{need}</b>.
          {' '}An admin can change your role, or sign up a new {need} account.</p>
      )}
    </div>
  )
}
