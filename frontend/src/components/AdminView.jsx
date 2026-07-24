import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { hasSupabase } from '../lib/supabase'
import { api } from '../lib/api'
import * as db from '../lib/db'
import { SKILLSET_CODES, catName } from '../lib/skills'
import { Gate } from './EmployerView'
import UniversePanel from './UniversePanel'
import Icon from './Icon'

export default function AdminView({ onSignIn, onChanged }) {
  const { user, role } = useAuth()
  const [companies, setCompanies] = useState([])
  const [users, setUsers] = useState([])
  const [candidates, setCandidates] = useState([])
  const [newco, setNewco] = useState('')
  const [nc, setNc] = useState({ name: '', email: '', password: '' })
  const [busy, setBusy] = useState('')
  const [toast, setToast] = useState('')

  const canUse = hasSupabase && user && role === 'admin'

  const refreshPeople = async () => {
    await Promise.all([
      db.listUsers().then(setUsers).catch(() => {}),
      db.listCandidates().then(setCandidates).catch(() => {}),
    ])
  }

  useEffect(() => {
    if (!canUse) return
    db.listCompaniesWithBars().then(setCompanies).catch(() => {})
    refreshPeople()
  }, [canUse])

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2500) }
  const changed = () => { onChanged?.() }

  // ---- live tallies (update the moment a company/candidate is added or removed,
  //      or a new user registers and this list is refreshed) ----
  const counts = users.reduce((a, u) => {
    a.total += 1; a[u.role] = (a[u.role] || 0) + 1; return a
  }, { total: 0, candidate: 0, employer: 0, admin: 0 })

  const setLevel = (ci, code, val) => {
    setCompanies((prev) => prev.map((c, i) =>
      i === ci ? { ...c, skillsets: { ...c.skillsets, [code]: val } } : c))
  }

  async function saveBar(c) {
    setBusy('Saving bars…')
    try { await db.updateCompanyBar(c.id, c.skillsets); flash(`${c.name} bars saved`); changed() }
    catch (e) { flash('Save failed: ' + e.message) } finally { setBusy('') }
  }

  async function addCompany() {
    if (!newco.trim()) return
    setBusy('Adding company…')
    try {
      const c = await db.createCompany(newco.trim())
      setCompanies((p) => [...p, { id: c.id, name: c.name, skillsets: {} }])
      setNewco(''); flash('Company added'); changed()
    } catch (e) { flash('Failed: ' + e.message) } finally { setBusy('') }
  }

  async function removeCompany(c) {
    if (!window.confirm(`Delete “${c.name}” and its skillset bars? This affects Talent Check everywhere.`)) return
    setBusy('Deleting company…')
    try {
      await db.deleteCompany(c.id)
      setCompanies((p) => p.filter((x) => x.id !== c.id))
      flash('Company deleted'); changed()
    } catch (e) { flash('Delete failed: ' + e.message) } finally { setBusy('') }
  }

  async function changeRole(id, r) {
    try { await db.updateUserRole(id, r); setUsers((p) => p.map((u) => u.id === id ? { ...u, role: r } : u)); flash('Role updated'); changed() }
    catch (e) { flash('Failed: ' + e.message) }
  }

  async function addCandidate() {
    if (!nc.name.trim() || !nc.email.trim()) { flash('Name and email are required'); return }
    setBusy('Adding candidate…')
    try {
      await api.adminAddCandidate({
        name: nc.name.trim(), email: nc.email.trim(),
        password: nc.password.trim() || undefined,
      })
      setNc({ name: '', email: '', password: '' })
      flash('Candidate added'); await refreshPeople(); changed()
    } catch (e) { flash('Failed: ' + e.message) } finally { setBusy('') }
  }

  async function removeCandidate(c) {
    if (!window.confirm(`Delete candidate “${c.name || c.email}”? This removes their account.`)) return
    setBusy('Deleting candidate…')
    try {
      await api.adminDeleteCandidate(c.user_id)
      setCandidates((p) => p.filter((x) => x.user_id !== c.user_id))
      flash('Candidate deleted'); await refreshPeople(); changed()
    } catch (e) { flash('Delete failed: ' + e.message) } finally { setBusy('') }
  }

  if (!canUse) {
    return <Gate onSignIn={onSignIn} loggedIn={!!user} role={role} need="admin"
      title="Admin console" blurb="Manage companies, the 12-skillset expectation bars, and user roles." />
  }

  return (
    <div className="profile">
      {toast && <div className="toast">{toast}</div>}

      {/* live platform tallies */}
      <div className="kpis" style={{ marginBottom: 18 }}>
        <Tile label="Companies" value={companies.length} sub="with skillset bars" />
        <Tile label="Candidates" value={counts.candidate} sub="registered on platform" />
        <Tile label="Employers" value={counts.employer} sub="posting roles" />
        <Tile label="Total users" value={counts.total} sub={`${counts.admin} admin`} />
      </div>

      <div className="pcard">
        <div className="admin-head">
          <h2>Company skillset bars ({companies.length})</h2>
          <div className="add-co">
            <input placeholder="New company name…" value={newco}
              onChange={(e) => setNewco(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCompany()} />
            <button className="primary" onClick={addCompany} disabled={!!busy}>Add</button>
          </div>
        </div>
        <p className="muted">The expected level (0–10) per skillset. Talent Check scores candidates against these bars. Adding or deleting a company updates every dashboard and analytics count.</p>

        <div className="bar-editor">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                {SKILLSET_CODES.map((c) => <th key={c} title={catName(c)}>{c}</th>)}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c, ci) => (
                <tr key={c.id}>
                  <td className="coname">{c.name}</td>
                  {SKILLSET_CODES.map((code) => (
                    <td key={code}>
                      <input type="number" min="0" max="10" value={c.skillsets[code] ?? ''}
                        onChange={(e) => setLevel(ci, code, e.target.value)} />
                    </td>
                  ))}
                  <td className="rowacts">
                    <button className="primary sm" onClick={() => saveBar(c)} disabled={!!busy}>Save</button>
                    <button className="icon-danger" title="Delete company" onClick={() => removeCompany(c)} disabled={!!busy}>
                      <Icon name="x" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {companies.length === 0 && (
                <tr><td colSpan={SKILLSET_CODES.length + 2} className="muted" style={{ padding: 16 }}>No companies yet — add one above.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* company universe (external DB): analytics + import */}
      <UniversePanel flash={flash} onImported={() => {
        db.listCompaniesWithBars().then(setCompanies).catch(() => {})
        changed()
      }} />

      {/* candidate management */}
      <div className="pcard" style={{ marginTop: 18 }}>
        <div className="admin-head">
          <h2>Candidates ({candidates.length})</h2>
        </div>
        <p className="muted">Add a candidate account or remove one. New candidates appear instantly in the pool, analytics and counts.</p>
        <div className="add-cand">
          <input placeholder="Full name" value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} />
          <input placeholder="Email" value={nc.email} onChange={(e) => setNc({ ...nc, email: e.target.value })} />
          <input placeholder="Password (optional)" value={nc.password} onChange={(e) => setNc({ ...nc, password: e.target.value })} />
          <button className="primary" onClick={addCandidate} disabled={!!busy}>Add candidate</button>
        </div>
        <div className="listing" style={{ marginTop: 14 }}>
          {candidates.length === 0 && <p className="muted">No candidate profiles yet.</p>}
          {candidates.map((c) => (
            <div className="lrow" key={c.user_id}>
              <div><b>{c.name || 'Unnamed'}</b><span>{c.email} · {(c.skills || []).length} skills</span></div>
              <button className="icon-danger" title="Delete candidate" onClick={() => removeCandidate(c)} disabled={!!busy}>
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* user roles */}
      <div className="pcard" style={{ marginTop: 18 }}>
        <h2>Users &amp; roles ({users.length})</h2>
        <div className="listing">
          {users.map((u) => (
            <div className="lrow" key={u.id}>
              <div><b>{u.full_name || u.email}</b><span>{u.email}</span></div>
              <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value)}>
                <option value="candidate">candidate</option>
                <option value="employer">employer</option>
                <option value="admin">admin</option>
              </select>
            </div>
          ))}
        </div>
      </div>
      {busy && <div className="busy">{busy}</div>}
    </div>
  )
}

function Tile({ label, value, sub }) {
  return <div className="kpi"><div className="kl">{label}</div><div className="kv">{value}</div><div className="ks">{sub}</div></div>
}
