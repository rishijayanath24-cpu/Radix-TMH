import { useEffect, useMemo, useState } from 'react'
import { loadCompanyUniverse, candidateLevels, readiness, PROF_NAME } from '../lib/explore'
import { SKILLSET_CODES, catName, catColor, matchLabel } from '../lib/skills'

const scoreColor = (s) => (s >= 80 ? '#28a05a' : s >= 60 ? '#3aa0e0' : s >= 40 ? '#e0b400' : '#e5484d')

// Candidate tab: rank all 116 companies by how ready this candidate is for each,
// scored on RADIX's 12 skillsets (Talent Check readiness, computed client-side).
export default function ExploreCompanies({ profile, onBuild }) {
  const [universe, setUniverse] = useState(null)   // null = loading, [] = none
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('score')         // 'score' | 'name'
  const [openId, setOpenId] = useState(null)

  useEffect(() => {
    let cancelled = false
    loadCompanyUniverse()
      .then((u) => { if (!cancelled) setUniverse(u) })
      .catch((e) => { if (!cancelled) { setErr(e.message || 'Failed to load'); setUniverse([]) } })
    return () => { cancelled = true }
  }, [])

  const skills = profile?.skills || []
  const hasSkills = skills.length > 0
  const levels = useMemo(() => candidateLevels(skills), [skills])

  const scored = useMemo(() => {
    const list = (universe || []).map((c) => ({ ...c, score: readiness(levels, c.bar) }))
    const f = q.trim().toLowerCase()
    const filtered = f ? list.filter((c) => c.name.toLowerCase().includes(f)) : list
    filtered.sort((a, b) => (sort === 'name'
      ? a.name.localeCompare(b.name)
      : (b.score - a.score) || a.name.localeCompare(b.name)))
    return filtered
  }, [universe, levels, q, sort])

  if (universe && universe.length === 0 && !err) {
    return (
      <div className="analytics">
        <div className="ahead"><h1>Explore Companies</h1>
          <p className="muted">Company database not linked. Add <code>COMPANIES_SUPABASE_URL</code> and <code>COMPANIES_SUPABASE_SERVICE_KEY</code> to <code>backend/.env</code>.</p></div>
      </div>
    )
  }
  if (universe === null) {
    return <div className="analytics"><div className="ahead"><h1>Explore Companies</h1><p className="muted">Loading company universe…</p></div></div>
  }

  const total = universe.length
  const avg = scored.length ? Math.round(scored.reduce((a, c) => a + c.score, 0) / scored.length) : 0
  const strong = scored.filter((c) => c.score >= 80).length
  const ready = scored.filter((c) => c.score >= 60).length

  return (
    <div className="analytics">
      <div className="ahead">
        <h1>Explore Companies</h1>
        <p className="muted">Your readiness across <b>{total}</b> companies, scored on RADIX’s 12 skillsets{profile?.name ? <> — viewing as <b>{profile.name}</b></> : null}.</p>
      </div>

      {!hasSkills && (
        <div className="acard" style={{ marginBottom: 16 }}>
          <h3>Build your profile to see your fit</h3>
          <div className="sub">Every score below is 0 until we know your skills. Add your skills (or upload a résumé) and this page ranks all {total} companies by how ready you are.</div>
          {onBuild && <button className="primary" style={{ marginTop: 12 }} onClick={onBuild}>Build my profile →</button>}
        </div>
      )}

      <div className="kpis">
        <Kpi label="Companies" value={total} sub="in the universe" />
        <Kpi label="Avg readiness" value={`${avg}%`} sub="your fit across all" />
        <Kpi label="Strong fits" value={strong} sub="readiness ≥ 80%" />
        <Kpi label="Job-ready" value={ready} sub="readiness ≥ 60%" />
      </div>

      <div className="explore-bar">
        <input className="explore-search" placeholder={`Search ${total} companies…`} value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="explore-sort">
          <button className={sort === 'score' ? 'on' : ''} onClick={() => setSort('score')}>Best fit</button>
          <button className={sort === 'name' ? 'on' : ''} onClick={() => setSort('name')}>A–Z</button>
        </div>
        <span className="explore-count">{scored.length} shown</span>
      </div>

      <div className="explore-list">
        {scored.length === 0 && <div className="acard"><div className="sub">No companies match “{q}”.</div></div>}
        {scored.map((c) => (
          <CompanyRow key={c.id} c={c} levels={levels} hasSkills={hasSkills}
            open={openId === c.id} onToggle={() => setOpenId(openId === c.id ? null : c.id)} />
        ))}
      </div>
      {err && <p className="muted" style={{ marginTop: 12 }}>Note: {err}</p>}
    </div>
  )
}

function CompanyRow({ c, levels, hasSkills, open, onToggle }) {
  // strengths = skillsets where the candidate meets/exceeds the bar; gaps = shortfalls
  const gaps = SKILLSET_CODES
    .map((code) => ({ code, req: c.bar[code] || 0, you: levels[code] || 0 }))
    .filter((x) => x.req > 0)
  const metCount = gaps.filter((x) => x.you >= x.req).length
  const topGaps = gaps.filter((x) => x.you < x.req).sort((a, b) => (b.req - b.you) - (a.req - a.you)).slice(0, 3)

  return (
    <div className={`explore-row${open ? ' open' : ''}`}>
      <div className="explore-head" onClick={onToggle}>
        <div className="explore-name">
          <b>{c.name}</b>
          <span className="muted">
            {hasSkills
              ? <>{metCount}/{gaps.length} skillsets met{topGaps.length ? <> · gaps: {topGaps.map((g) => g.code).join(', ')}</> : ' · full match'}</>
              : 'build your profile to score'}
          </span>
        </div>
        <div className="explore-score">
          <span className="score-pill" style={{ background: scoreColor(c.score) }}>{c.score}%</span>
          <span className="score-lab">{matchLabel(c.score)}</span>
          <span className="explore-chev">{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <div className="explore-detail">
          {SKILLSET_CODES.map((code) => {
            const req = c.bar[code] || 0
            const you = levels[code] || 0
            const met = you >= req
            return (
              <div className="cmp-row" key={code}>
                <span className="cmp-lab" title={`${catName(code)} · required proficiency: ${PROF_NAME[c.prof[code]] || c.prof[code] || '—'}`}>{catName(code)}</span>
                <span className="cmp-track">
                  <span className="cmp-req" style={{ width: `${req * 10}%` }} />
                  <span className="cmp-you" style={{ width: `${you * 10}%`, background: catColor(code) }} />
                </span>
                <span className={`cmp-val ${met ? 'ok' : 'gap'}`}>{you}/{req}</span>
              </div>
            )
          })}
          <div className="cmp-legend">
            <span><i className="lg-you" /> you</span>
            <span><i className="lg-req" /> required</span>
          </div>
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value, sub }) {
  return <div className="kpi"><div className="kl">{label}</div><div className="kv">{value}</div><div className="ks">{sub}</div></div>
}
