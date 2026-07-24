import { useEffect, useMemo, useState } from 'react'
import {
  loadCompanyUniverse, marketAverageBar, findUniverseCompany,
  barFromJDs, roundBar, candidateLevels, readiness,
} from '../lib/explore'
import { SKILLSET_CODES, catName, catColor } from '../lib/skills'

const scoreColor = (s) => (s >= 80 ? '#28a05a' : s >= 60 ? '#3aa0e0' : s >= 40 ? '#e0b400' : '#e5484d')

// Employer panel powered by the 116-company universe:
//   • seed a TARGET expectation bar (market average / copy a company / from my JDs)
//   • benchmark that bar against the market, per skillset
//   • rank the candidate pool by readiness to it
export default function HiringBar({ companyName = 'all', jds = [], candidates = [] }) {
  const [universe, setUniverse] = useState(null)
  const [mode, setMode] = useState('market')     // 'market' | 'company' | 'jds'
  const [pick, setPick] = useState('')            // universe company name (copy mode)

  useEffect(() => {
    loadCompanyUniverse().then(setUniverse).catch(() => setUniverse([]))
  }, [])

  // Sensible default: if the selected company matches one in the universe, copy it.
  useEffect(() => {
    if (!universe?.length) return
    if (companyName && companyName !== 'all') {
      const hit = findUniverseCompany(universe, companyName)
      if (hit) { setMode('company'); setPick(hit.name); return }
    }
    if (jds.length) setMode('jds')
  }, [universe, companyName])

  const market = useMemo(() => (universe ? marketAverageBar(universe) : {}), [universe])

  const target = useMemo(() => {
    if (!universe) return {}
    if (mode === 'company') {
      const c = universe.find((x) => x.name === pick) || findUniverseCompany(universe, companyName)
      return c ? c.bar : roundBar(market)
    }
    if (mode === 'jds') return barFromJDs(jds)
    return roundBar(market)
  }, [universe, mode, pick, companyName, jds, market])

  const ranked = useMemo(() => {
    return (candidates || [])
      .map((c) => ({
        name: c.profile?.name || c.source_file,
        score: readiness(candidateLevels(c.profile?.skills || []), target),
      }))
      .sort((a, b) => b.score - a.score)
  }, [candidates, target])

  if (universe === null) return <div className="acard" style={{ marginTop: 16 }}><div className="sub">Loading market data…</div></div>
  if (!universe.length) return null

  const above = SKILLSET_CODES.filter((code) => (target[code] || 0) > Math.round(market[code] || 0)).length
  const below = SKILLSET_CODES.filter((code) => (target[code] || 0) < Math.round(market[code] || 0)).length

  return (
    <div className="acard" style={{ marginTop: 16 }}>
      <div className="hb-head">
        <div>
          <h3>Hiring bar &amp; market benchmark</h3>
          <div className="sub">Set a target bar and see how it compares to the market of {universe.length} companies — then rank your candidate pool against it.</div>
        </div>
        <div className="hb-controls">
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="market">Market average</option>
            <option value="company">Copy a company…</option>
            <option value="jds" disabled={!jds.length}>From my job descriptions</option>
          </select>
          {mode === 'company' && (
            <select value={pick} onChange={(e) => setPick(e.target.value)}>
              {!pick && <option value="">Pick a company…</option>}
              {universe.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          )}
        </div>
      </div>

      <p className="hb-summary">
        Your target bar is <b>above market</b> on {above} skillset{above === 1 ? '' : 's'} and <b>below</b> on {below}.
      </p>

      {/* benchmark: target vs market per skillset */}
      <div className="hb-bench">
        {SKILLSET_CODES.map((code) => {
          const t = target[code] || 0
          const m = market[code] || 0
          const delta = t - Math.round(m)
          return (
            <div className="hb-row" key={code}>
              <span className="hb-lab" title={catName(code)}>{catName(code)}</span>
              <span className="hb-track">
                <span className="hb-mkt" style={{ left: `${Math.round(m) * 10}%` }} title={`market avg ${m.toFixed(1)}`} />
                <span className="hb-tgt" style={{ width: `${t * 10}%`, background: catColor(code) }} />
              </span>
              <span className="hb-val">{t}<span className="hb-vs">/{m.toFixed(1)}</span>
                {delta !== 0 && <b className={delta > 0 ? 'up' : 'dn'}>{delta > 0 ? `+${delta}` : delta}</b>}
              </span>
            </div>
          )
        })}
        <div className="hb-legend">
          <span><i className="lg-tgt" /> your target</span>
          <span><i className="lg-mkt" /> market avg</span>
        </div>
      </div>

      {/* candidate ranking vs the target bar */}
      <h3 style={{ marginTop: 18 }}>Candidates ranked to this bar</h3>
      <div className="sub">Readiness of your pool against the target — {ranked.filter((r) => r.score >= 60).length} of {ranked.length} are job-ready (≥60%).</div>
      <div className="hb-cands">
        {ranked.length === 0 && <div className="sub">No candidates in the pool yet.</div>}
        {ranked.slice(0, 12).map((r, i) => (
          <div className="hb-cand" key={i}>
            <b>{r.name}</b>
            <span className="hb-bar"><span style={{ width: `${r.score}%`, background: scoreColor(r.score) }} /></span>
            <span className="hb-pct" style={{ color: scoreColor(r.score) }}>{r.score}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
