import { useCallback, useEffect, useMemo, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { loadDemo, api } from './lib/api'
import { loadLiveData } from './lib/live'
import { useAuth } from './lib/auth'
import * as db from './lib/db'
import MatchCard from './components/MatchCard'
import RadialChart from './components/RadialChart'
import ProfileView from './components/ProfileView'
import EmployerView from './components/EmployerView'
import AdminView from './components/AdminView'
import ExploreCompanies from './components/ExploreCompanies'
import HiringBar from './components/HiringBar'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Icon from './components/Icon'
import AnalyticsView from './components/AnalyticsView'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/login/:role" element={<Login />} />
      <Route path="/app" element={<Dashboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

const ROLE_BADGE = { candidate: 'Candidate', employer: 'Employer', admin: 'Admin' }

function Dashboard() {
  const { user, profile, role, signOut, hasSupabase } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [ci, setCi] = useState(0)
  const [mode, setMode] = useState('find')     // 'find' | 'hire'
  const [view, setView] = useState('dashboard') // 'dashboard' | 'profile'
  const [health, setHealth] = useState(null)
  const [open, setOpen] = useState('rec')
  const [menu, setMenu] = useState(false)
  const [me, setMe] = useState(null)
  const [live, setLive] = useState(null)
  const [myJds, setMyJds] = useState(null)      // the employer's OWN postings (live)
  const [empCompany, setEmpCompany] = useState('all') // which of their companies to view

  useEffect(() => { loadDemo().then(setData).catch(() => setData({ error: true })) }, [])
  useEffect(() => { api.health().then(setHealth).catch(() => setHealth(null)) }, [])

  // An employer/admin only ever sees the JDs THEY posted — never the whole
  // platform. Everything on the employer surfaces (list, counts, analytics) is
  // then further scoped to the selected company.
  const reloadMyJds = useCallback(() => {
    if (!hasSupabase || !user || !(role === 'employer' || role === 'admin')) { setMyJds(null); return }
    db.listJDsByUploader(user.id).then(setMyJds).catch(() => setMyJds([]))
  }, [hasSupabase, user, role])
  useEffect(() => { reloadMyJds() }, [reloadMyJds])

  // Pull the live Supabase state (companies + candidate pool) and let it drive
  // every count/list/chart. Re-runnable so admin edits and new registrations show
  // up immediately (also refreshed when the tab regains focus).
  const reloadLive = useCallback(async () => {
    if (!hasSupabase || !user || !data?.jds) { setLive(null); return }
    try { setLive(await loadLiveData(data.jds)) } catch { setLive(null) }
  }, [hasSupabase, user, data])
  useEffect(() => { reloadLive() }, [reloadLive])
  useEffect(() => {
    const onFocus = () => reloadLive()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [reloadLive])

  // A signed-in candidate always views as THEMSELVES first — labelled with the
  // name they gave when creating the account (profiles.full_name). If they've
  // built a profile we compute their live matches; if not, the entry still shows
  // (with their name) so a brand-new candidate never lands on a demo person.
  useEffect(() => {
    if (!hasSupabase || !user || !data?.jds || (role && role !== 'candidate')) { setMe(null); return }
    let cancelled = false
    ;(async () => {
      const accountName = profile?.full_name || user.email?.split('@')[0] || 'You'
      try {
        const prof = await db.loadMyProfile(user.id)
        const hasSkills = !!(prof && (prof.skills || []).length)
        const p = {
          name: prof?.name || accountName,
          email: prof?.email || user.email,
          education: prof?.education || '',
          skills: prof?.skills || [],
          preferred_roles: prof?.preferred_roles || [],
        }
        let matches = [], talent_checks = []
        if (hasSkills) {
          matches = (await Promise.all(data.jds.map((jd) => api.skillMatch(p, jd))))
            .sort((a, b) => b.match_score - a.match_score)
          talent_checks = await Promise.all((data.companies || []).map((c) => api.talentCheck(p, c.name)))
        }
        if (!cancelled) { setMe({ source_file: 'you', accountName, hasSkills, profile: p, matches, talent_checks }); setCi(0) }
      } catch {
        if (!cancelled) setMe({ source_file: 'you', accountName, hasSkills: false, profile: { name: accountName, skills: [] }, matches: [], talent_checks: [] })
      }
    })()
    return () => { cancelled = true }
  }, [user, profile, role, data])
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const v = q.get('view')
    if (['profile', 'explore', 'employer', 'admin'].includes(v)) setView(v)
    if (q.get('mode') === 'hire') setMode('hire')
  }, [])

  if (!data) return <Shell><div className="loading">Loading RADIX Talent Match…</div></Shell>
  if (data.error) return <Shell><div className="loading">Could not load demo data. Run <code>python make_demo_data.py</code>.</div></Shell>

  // Live data is the single source of truth once signed in — this is what makes
  // adds, deletes and registrations reflect everywhere. Fall back to the baked
  // demo set when signed out / Supabase returns nothing.
  //   • Companies are readable by every authenticated user → always prefer live.
  //   • The full candidate pool is only visible to employer/admin (RLS); a plain
  //     candidate can read only their own row, so keep the demo pool for browsing.
  const companies = live?.companies?.length ? live.companies : (data.companies || [])
  const canSeePool = role === 'admin' || role === 'employer'
  const liveCandidates = (canSeePool && live?.candidates?.length) ? live.candidates : (data.candidates || [])
  const jds = data.jds || []
  const mergedData = { ...data, companies, candidates: liveCandidates }

  // Employer scope: their own JDs, the distinct companies they hire for, and the
  // JDs for the currently selected company (normalised to the analytics shape).
  const ownJds = myJds || []
  const empCompanyList = [...new Set(ownJds.map((j) => j.company_name).filter(Boolean))].sort()
  const scopedOwnJds = empCompany === 'all' ? ownJds : ownJds.filter((j) => j.company_name === empCompany)
  const scopedJdsA = scopedOwnJds.map((j) => ({
    source_file: j.source_file, role: j.role, company: j.company_name, skills: j.skills || [],
  }))
  const employerData = { ...mergedData, jds: scopedJdsA }
  const isEmployerSurface = (role === 'employer' || role === 'admin') &&
    (view === 'employer' || (view === 'dashboard' && role === 'employer'))

  // The signed-in candidate's own live view ("⭐ You") — don't list them twice.
  const pool = liveCandidates.filter((c) => !(me && c.user_id && c.user_id === user?.id))
  const allCandidates = me ? [me, ...pool] : pool
  const cand = allCandidates[ci] || allCandidates[0]
  const matches = cand?.matches || []
  const offers = matches.filter((m) => m.match_score >= 60).length

  const navTo = (v) => { setView(v); setMenu(false) }

  // Only functional, role-appropriate tabs.
  const navItems = [{ v: 'dashboard', label: 'Overview' }]
  if (!role || role === 'candidate') navItems.push({ v: 'profile', label: 'My Profile' })
  if (!role || role === 'candidate') navItems.push({ v: 'explore', label: 'Explore Companies' })
  if (role === 'employer' || role === 'admin') navItems.push({ v: 'employer', label: 'Employer' })
  if (role === 'admin') navItems.push({ v: 'admin', label: 'Admin' })
  const showToggle = !role || role === 'candidate'

  return (
    <Shell>
      {/* ---------- top bar ---------- */}
      <div className="topbar">
        <div className="brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}><div className="logo">R</div></div>
        <nav className="nav">
          {navItems.map((it) => (
            <a key={it.v} className={view === it.v ? 'active' : ''} onClick={() => navTo(it.v)}>{it.label}</a>
          ))}
        </nav>

        {showToggle && (
          <div className="toggle">
            <button className={mode === 'hire' ? 'on' : ''} onClick={() => { setMode('hire'); setView('dashboard') }}>Hire</button>
            <button className={mode === 'find' ? 'on' : ''} onClick={() => { setMode('find'); setView('dashboard') }}>Find a job</button>
          </div>
        )}

        {user ? (
          <div className="userchip" onClick={() => setMenu(!menu)}>
            <div className="uav">{(profile?.full_name || user.email || '?')[0].toUpperCase()}</div>
            <div className="uinfo">
              <b>{profile?.full_name || user.email.split('@')[0]}</b>
              <span>{ROLE_BADGE[role] || 'Candidate'}</span>
            </div>
            <span className="ucar">▾</span>
            {menu && (
              <div className="umenu" onClick={(e) => e.stopPropagation()}>
                {(!role || role === 'candidate') && <div onClick={() => navTo('profile')}>My Profile</div>}
                <div onClick={async () => { setMenu(false); await signOut(); navigate('/') }}>Sign out</div>
              </div>
            )}
          </div>
        ) : (
          <button className="signin" onClick={() => navigate('/login')}>Sign in</button>
        )}
      </div>

      <div className="body">
        <div className="content">
          <EngineBanner health={health} hasSupabase={hasSupabase} loggedIn={!!user} companiesCount={companies.length} />

          {isEmployerSurface && (
            <CompanyScope company={empCompany} setCompany={setEmpCompany}
              list={empCompanyList} count={scopedOwnJds.length} />
          )}

          {view === 'profile' ? (
            <ProfileView companies={companies} jds={jds} onSignIn={() => navigate('/login')} />
          ) : view === 'explore' ? (
            <ExploreCompanies profile={cand?.profile} onBuild={() => navTo('profile')} />
          ) : view === 'employer' ? (
            <EmployerView onSignIn={() => navigate('/login')} jds={scopedOwnJds}
              company={empCompany} onPosted={reloadMyJds} />
          ) : view === 'admin' ? (
            <AdminView onSignIn={() => navigate('/login')} onChanged={reloadLive} />
          ) : role === 'admin' ? (
            <AnalyticsView data={mergedData} variant="admin" />
          ) : role === 'employer' ? (
            <>
              <AnalyticsView data={employerData} variant="employer" company={empCompany} scoped />
              <HiringBar companyName={empCompany} jds={scopedOwnJds} candidates={mergedData.candidates} />
            </>
          ) : mode === 'hire' ? (
            <AnalyticsView data={mergedData} variant="employer" />
          ) : (
            <FindView {...{ candidates: allCandidates, cand, matches, companies, jds, offers, ci, setCi, open, setOpen, setView, hasMe: !!me, meName: me?.accountName }} />
          )}
        </div>
      </div>
    </Shell>
  )
}

/* ---------------- candidate dashboard ---------------- */
function FindView({ candidates, cand, matches, companies, jds, offers, ci, setCi, open, setOpen, setView, hasMe, meName }) {
  const topMatches = useMemo(() => matches.slice(0, 4), [matches])
  const [showDemo, setShowDemo] = useState(false)
  // A signed-in candidate sees only their own name by default; the demo-candidate
  // switcher stays hidden until they click "View demo".
  const pickerOpen = !hasMe || showDemo
  return (
    <>
      <div className="top-area">
        <div className="hero">
          <h1>YOUR<span className="l2">JOB MATCH</span><span className="pill">AI · Powered</span></h1>
          <p>AI mapped {cand?.profile?.skills?.length || 0} skills from this profile onto RADIX's 12 skillsets and ranked every open role.</p>
          <div className="who">
            <label>Viewing as</label>
            {pickerOpen ? (
              <select value={ci} onChange={(e) => setCi(Number(e.target.value))}>
                {candidates.map((c, i) => (
                  <option key={i} value={i}>
                    {c.source_file === 'you' ? `⭐ You (${c.profile?.name || 'your profile'})` : (c.profile?.name || c.source_file)}
                  </option>
                ))}
              </select>
            ) : (
              <span className="viewing-name">{meName || 'You'}</span>
            )}
            {hasMe && (showDemo
              ? <button className="ghost" onClick={() => { setShowDemo(false); setCi(0) }}>← My view</button>
              : <button className="ghost" onClick={() => setShowDemo(true)}>View demo →</button>
            )}
            <button className="ghost" onClick={() => setView('profile')}>{hasMe ? 'Edit my profile →' : 'Build your own →'}</button>
          </div>
        </div>

        <div className="chart-card">
          <RadialChart markers={[`${jds.length} JDs`, `${offers} fits`, `${matches[0]?.match_score || 0}% top`]} />
          <div className="cap">How this candidate matches every open role</div>
          <div className="axis"><span>weakest</span><span>strongest</span></div>
        </div>

        <div className="panels">
          <Panel id="rec" open={open} setOpen={setOpen} title="Talent recruitment"
            rows={[['building', 'Companies', companies.length], ['briefcase', 'Vacancies', jds.length], ['target', 'Strong fits', offers]]} />
          <Panel id="tc" open={open} setOpen={setOpen} title="Talent Check"
            rows={(cand?.talent_checks || []).map((t) => ['check', shorten(t.company), `${t.readiness_score}%`])} />
          <Panel id="best" open={open} setOpen={setOpen} title="Best matches"
            rows={matches.slice(0, 3).map((m) => ['star', shorten(m.company), `${m.match_score}%`])} />
        </div>
      </div>

      <div className="filters">
        <span className="funnel"><Icon name="filter" size={16} /></span>
        {(cand?.profile?.preferred_roles?.filter(Boolean).slice(0, 1) || []).map((r) => <Chip key={r}>{r}</Chip>)}
        <Chip>Full time</Chip><Chip>Entry / New grad</Chip><Chip>Hybrid</Chip>
        <div className="pager">
          <button><Icon name="arrowLeft" size={16} /></button>
          <span className="count"><b>{String(Math.min(matches.length, 4)).padStart(2, '0')}</b>/{matches.length}</span>
          <button><Icon name="arrowRight" size={16} /></button>
        </div>
      </div>

      <div className="cards">
        {topMatches.map((m, i) => <MatchCard key={i} match={m} top={i === 0} />)}
      </div>
    </>
  )
}

/* ---------------- shared bits ---------------- */
function Shell({ children }) {
  return <div className="stage"><div className="app">{children}</div></div>
}

// Employer-only control: pick which of your companies to view. Everything below
// (postings, counts, analytics) is scoped to the selection.
function CompanyScope({ company, setCompany, list, count }) {
  return (
    <div className="coscope">
      <span className="cl">Viewing company</span>
      <select value={company} onChange={(e) => setCompany(e.target.value)}>
        <option value="all">All my companies</option>
        {list.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <span className="cc">{count} {count === 1 ? 'role' : 'roles'} posted</span>
    </div>
  )
}

function EngineBanner({ health, hasSupabase, loggedIn, companiesCount }) {
  const ok = health?.status === 'ok'
  const nco = companiesCount ?? health?.companies_loaded
  return (
    <div className="banner">
      <span className="k">{ok ? '● AI engine live' : '○ demo data'}</span>
      {ok ? `${health.llm?.provider} · ${health.llm?.model} · ${nco} companies` : 'start backend for live parsing'}
      <span style={{ marginLeft: 'auto', color: '#949aa4' }}>
        {!hasSupabase ? 'Supabase not linked' : loggedIn ? 'signed in' : 'demo mode · sign in to save'}
      </span>
    </div>
  )
}

function Panel({ id, open, setOpen, title, rows }) {
  const isOpen = open === id
  return (
    <div className="panel">
      <div className="head" onClick={() => setOpen(isOpen ? '' : id)}>
        <b>{title}</b><span className="chev"><Icon name={isOpen ? 'chevronUp' : 'chevronDown'} size={15} /></span>
      </div>
      {isOpen && (
        <div className="rows">
          {rows.length === 0 && <div className="row" style={{ color: 'var(--ink-4)' }}>No data</div>}
          {rows.map((r, i) => <div className="row" key={i}><span className="dot"><Icon name={r[0]} size={14} /></span>{r[1]}<b>{r[2]}</b></div>)}
        </div>
      )}
    </div>
  )
}

function Chip({ children }) {
  return <span className="chip">{children}<span className="x"><Icon name="x" size={11} /></span></span>
}

const shorten = (s = '') => (s.length > 16 ? s.slice(0, 15) + '…' : s)
