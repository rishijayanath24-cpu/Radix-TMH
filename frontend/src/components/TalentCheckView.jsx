import { useMemo, useState } from 'react'
import Gauge from './Gauge'
import { SKILLSET_CODES, catName } from '../lib/skills'

// Gap severity → status label + bar color. Neutral for small/no gap, escalating
// accent intensity as the gap widens (mirrors the Talent Check design spec).
function severity(required, level) {
  if (!required) return { label: '—', color: 'var(--ink-4)' }
  const gap = Math.max(required - level, 0)
  if (gap <= 0) return { label: 'Ready', color: 'var(--ink)' }
  if (gap <= 2) return { label: 'On track', color: 'var(--ink-3)' }
  if (gap <= 4) return { label: 'Gap', color: 'var(--accent)' }
  return { label: 'Priority gap', color: '#ae1800' }
}

function statusForScore(score) {
  if (score >= 80) return 'Ready'
  if (score >= 60) return 'Developing'
  return 'Needs work'
}

function summaryFor(score, companyName) {
  if (score >= 80) return `You're well matched to ${companyName}'s bar across most of the 12 skillsets — a strong position to apply from.`
  if (score >= 60) return `You're on track for ${companyName}, with a handful of skillsets worth closing before you apply.`
  return `There are real gaps against ${companyName}'s bar today — worth building up the priority skillsets below first.`
}

// Company selector + big gauge + 12-row gap-bar breakdown for one candidate,
// using precomputed Talent Check results (no extra API round-trips).
export default function TalentCheckView({ companies = [], talentChecks = [], candidateName }) {
  const [idx, setIdx] = useState(0)
  const safeIdx = Math.min(idx, Math.max(companies.length - 1, 0))
  const company = companies[safeIdx]
  const tc = talentChecks[safeIdx]

  const rows = useMemo(() => {
    if (!tc) return []
    return tc.skillset_gap
      .filter((g) => SKILLSET_CODES.includes(g.category_code))
      .sort((a, b) => SKILLSET_CODES.indexOf(a.category_code) - SKILLSET_CODES.indexOf(b.category_code))
  }, [tc])

  if (!companies.length) {
    return (
      <div className="analytics">
        <div className="ahead"><h1>Talent Check</h1>
          <p className="muted">No companies loaded yet.</p></div>
      </div>
    )
  }

  const score = tc?.readiness_score ?? 0

  return (
    <div className="analytics">
      <div className="tcv-head">
        <div>
          <div className="tcv-kicker">Talent Check</div>
          <h1>Readiness vs. {company?.name}</h1>
        </div>
        <div className="field" style={{ margin: 0, minWidth: 220 }}>
          <label className="flab">Company</label>
          <select value={safeIdx} onChange={(e) => setIdx(Number(e.target.value))}>
            {companies.map((c, i) => <option key={c.name + i} value={i}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="tcv-top-card">
        <Gauge value={score} size={168} stroke={11} label="out of 100" />
        <div className="tcv-top-copy">
          <span className="tag-outline" style={{ display: 'inline-block', padding: '4px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', border: '1px solid var(--accent)', color: 'var(--accent)', marginBottom: 10 }}>
            {statusForScore(score)}
          </span>
          <p style={{ fontSize: 15, lineHeight: 1.55, margin: 0 }}>{company && summaryFor(score, company.name)}</p>
          <p className="muted" style={{ marginTop: 8 }}>Required bars reflect {company?.name}'s current 12-skillset threshold, set in Admin.</p>
        </div>
      </div>

      <div className="hr" />

      <h3 style={{ margin: '18px 0 4px' }}>Skillset gap breakdown</h3>
      <p className="muted" style={{ margin: '0 0 14px' }}>{candidateName || 'Your'} level (filled bar) against {company?.name}'s required level (marker), on a 1–10 scale.</p>

      <div className="tcv-rows">
        {rows.map((g) => {
          const st = severity(g.required_level, g.candidate_level)
          return (
            <div className="tcv-row" key={g.category_code}>
              <div className="tcv-label">{catName(g.category_code)}</div>
              <div className="tcv-track">
                <div className="tcv-fill" style={{ width: `${g.candidate_level * 10}%`, background: st.color }} />
                <div className="tcv-marker" style={{ left: `${g.required_level * 10}%` }} />
              </div>
              <div className="tcv-status" style={{ color: st.color }}>{st.label}</div>
            </div>
          )
        })}
      </div>
      <div className="tcv-legend">
        <span><i className="sw" style={{ background: 'var(--ink)' }} />Candidate level</span>
        <span><i className="mk" />Required level</span>
      </div>
    </div>
  )
}
