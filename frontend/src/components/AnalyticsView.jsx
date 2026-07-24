import { catColor, catName, SKILLSET_CODES } from '../lib/skills'

const W = { high: 3, medium: 2, low: 1 }
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)
const short = (s = '') => (s.length > 22 ? s.slice(0, 21) + '…' : s)

// Role-specific analytics dashboard (employer | admin), built from the loaded data.
export default function AnalyticsView({ data, variant, company = 'all', scoped = false }) {
  const jds = data.jds || []
  const candidates = data.candidates || []
  const companies = data.companies || []

  if (variant === 'admin') return <AdminAnalytics {...{ jds, candidates, companies }} />
  return <EmployerAnalytics {...{ jds, candidates, company, scoped }} />
}

/* -------------------- employer -------------------- */
function EmployerAnalytics({ jds, candidates, company, scoped }) {
  // Every candidate metric is scoped to THIS employer's roles (the jds passed in
  // are already filtered to the selected company), so an employer's analytics
  // reflect only their own postings — never the whole platform.
  const jdFiles = new Set(jds.map((jd) => jd.source_file))
  const matchesFor = (c) => (c.matches || []).filter((m) => jdFiles.has(m.jd_source_file))

  const tops = candidates
    .map((c) => ({ name: c.profile?.name || c.source_file, best: matchesFor(c).sort((a, b) => b.match_score - a.match_score)[0] }))
    .filter((t) => t.best)
    .sort((a, b) => b.best.match_score - a.best.match_score)

  const strongFits = candidates.reduce(
    (n, c) => n + matchesFor(c).filter((m) => m.match_score >= 80).length, 0)
  const relevant = candidates.filter((c) => matchesFor(c).length).length
  const avgTop = Math.round(mean(tops.map((t) => t.best.match_score)))

  // skill demand across this company's JDs
  const demand = SKILLSET_CODES.map((code) => {
    let w = 0
    jds.forEach((jd) => (jd.skills || []).forEach((s) => { if (s.category_code === code) w += W[s.confidence] || 1 }))
    return { code, w }
  })
  const maxW = Math.max(1, ...demand.map((d) => d.w))
  const demandBars = demand
    .filter((d) => d.w > 0).sort((a, b) => b.w - a.w)
    .map((d) => ({ label: catName(d.code), value: Math.round((d.w / maxW) * 100), color: catColor(d.code), raw: d.w }))

  // best available candidate per open role
  const roleFit = jds.map((jd) => {
    let best = 0
    candidates.forEach((c) => {
      const m = (c.matches || []).find((x) => x.jd_source_file === jd.source_file)
      if (m) best = Math.max(best, m.match_score)
    })
    return { label: `${short(jd.role || jd.source_file)}`, value: best, color: 'var(--accent)' }
  }).sort((a, b) => b.value - a.value)

  const scopeName = company && company !== 'all' ? company : (scoped ? 'all your companies' : 'your roles')
  const sub = scoped
    ? `Scoped to ${scopeName} — your postings and how the candidate pool fits them.`
    : 'How your open roles and candidate pool stack up.'

  return (
    <div className="analytics">
      <Head title="Recruitment analytics" sub={sub} />
      {scoped && jds.length === 0 && (
        <div className="acard" style={{ marginBottom: 16 }}>
          <div className="sub">No roles posted for {scopeName} yet. Post a JD on the Employer tab to see analytics here.</div>
        </div>
      )}
      <div className="kpis">
        <Kpi label="Open roles" value={jds.length} sub={scoped ? `at ${scopeName}` : 'active job descriptions'} />
        <Kpi label="Matching candidates" value={relevant} sub="fit at least one of your roles" />
        <Kpi label="Avg top match" value={`${avgTop}%`} sub="best fit per candidate" />
        <Kpi label="Strong fits" value={strongFits} sub="candidate ↔ role ≥ 80%" />
      </div>
      <div className="agrid">
        <Acard title="Skill demand" sub="Most-required skillsets across your roles">
          <HBars items={demandBars} />
        </Acard>
        <Acard title="Best candidate per role" sub="Strongest match available for each posting">
          <HBars items={roleFit} suffix="%" />
        </Acard>
      </div>
      <Acard title="Top candidates" sub="Ranked by their strongest fit to your roles">
        {tops.length === 0 && <div className="sub">No candidate matches for these roles yet.</div>}
        {tops.map((t, i) => (
          <div className="arow" key={i}>
            <div><b>{t.name}</b><span className="muted"> · best fit: {t.best.role}</span></div>
            <span className="score-pill">{t.best.match_score}%</span>
          </div>
        ))}
      </Acard>
    </div>
  )
}

/* -------------------- admin -------------------- */
function AdminAnalytics({ jds, candidates, companies }) {
  const allLevels = companies.flatMap((c) => SKILLSET_CODES.map((code) => c.skillsets?.[code] || 0))
  const avgBar = (mean(allLevels)).toFixed(1)

  const expectation = SKILLSET_CODES.map((code) => {
    const avg = mean(companies.map((c) => c.skillsets?.[code] || 0))
    return { label: catName(code), value: Math.round(avg * 10), color: catColor(code), raw: avg.toFixed(2) }
  }).sort((a, b) => b.value - a.value)

  const compDemand = companies.map((c) => {
    const avg = mean(SKILLSET_CODES.map((code) => c.skillsets?.[code] || 0))
    return { label: short(c.name), value: Math.round(avg * 10), color: 'var(--accent)' }
  }).sort((a, b) => b.value - a.value)

  return (
    <div className="analytics">
      <Head title="Platform analytics" sub="Companies, roles, candidates, and skill expectations across RADIX." />
      <div className="kpis">
        <Kpi label="Companies" value={companies.length} sub="with skillset bars" />
        <Kpi label="Open roles" value={jds.length} sub="job descriptions" />
        <Kpi label="Candidates" value={candidates.length} sub="profiles on platform" />
        <Kpi label="Avg required level" value={`${avgBar}/10`} sub="across all skillset bars" />
      </div>
      <div className="agrid">
        <Acard title="Skill expectation" sub="Average required level per skillset (all companies)">
          <HBars items={expectation} />
        </Acard>
        <Acard title="Company demand" sub="How high each company sets the bar overall">
          <HBars items={compDemand} />
        </Acard>
      </div>
      <Acard title="Companies" sub="Overall hiring bar by company">
        {companies.map((c, i) => (
          <div className="arow" key={i}>
            <div><b>{c.name}</b></div>
            <span className="score-pill">{(mean(SKILLSET_CODES.map((code) => c.skillsets?.[code] || 0))).toFixed(1)}/10</span>
          </div>
        ))}
      </Acard>
    </div>
  )
}

/* -------------------- shared bits -------------------- */
function Head({ title, sub }) {
  return <div className="ahead"><h1>{title}</h1><p className="muted">{sub}</p></div>
}
function Kpi({ label, value, sub }) {
  return <div className="kpi"><div className="kl">{label}</div><div className="kv">{value}</div><div className="ks">{sub}</div></div>
}
function Acard({ title, sub, children }) {
  return <div className="acard"><h3>{title}</h3>{sub && <div className="sub">{sub}</div>}{children}</div>
}
function HBars({ items, suffix = '' }) {
  return (
    <div className="hbars">
      {items.map((it, i) => (
        <div className="hbar" key={i}>
          <span className="hl" title={it.label}>{it.label}</span>
          <span className="ht"><span className="hf" style={{ width: `${it.value}%`, background: it.color }} /></span>
          <span className="hv">{it.raw != null && suffix === '' ? it.raw : `${it.value}${suffix}`}</span>
        </div>
      ))}
    </div>
  )
}
