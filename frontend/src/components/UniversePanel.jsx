import { useEffect, useMemo, useState } from 'react'
import { loadCompanyUniverse, marketAverageBar } from '../lib/explore'
import * as db from '../lib/db'
import { SKILLSET_CODES, catName, catColor } from '../lib/skills'

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)

// Admin panel: analytics over the 116-company universe + one-click import of the
// whole universe (companies + 12-skillset bars) into the app's own tables.
export default function UniversePanel({ onImported, flash }) {
  const [universe, setUniverse] = useState(null)
  const [busy, setBusy] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => {
    loadCompanyUniverse().then(setUniverse).catch(() => setUniverse([]))
  }, [])

  const stats = useMemo(() => {
    if (!universe?.length) return null
    const avgBar = marketAverageBar(universe)
    const demand = SKILLSET_CODES
      .map((code) => ({ code, avg: avgBar[code] }))
      .sort((a, b) => b.avg - a.avg)
    const maxAvg = Math.max(1, ...demand.map((d) => d.avg))
    const hardest = universe
      .map((c) => ({ name: c.name, avg: mean(SKILLSET_CODES.map((code) => c.bar[code] || 0)) }))
      .sort((a, b) => b.avg - a.avg).slice(0, 8)
    const overall = mean(universe.flatMap((c) => SKILLSET_CODES.map((code) => c.bar[code] || 0)))
    return { demand, maxAvg, hardest, overall }
  }, [universe])

  async function importAll() {
    if (!universe?.length) return
    if (!window.confirm(`Import ${universe.length} companies and their 12-skillset bars into the platform? This is safe to re-run (updates existing).`)) return
    setBusy('Importing company universe…')
    try {
      const r = await db.bulkUpsertCompaniesWithBars(universe.map((c) => ({ name: c.name, bar: c.bar })))
      setResult(r)
      flash?.(`Imported ${r.companies} companies · ${r.bars} skillset bars`)
      onImported?.()
    } catch (e) { flash?.('Import failed: ' + e.message) } finally { setBusy('') }
  }

  if (universe && universe.length === 0) {
    return (
      <div className="pcard" style={{ marginTop: 18 }}>
        <h2>Company universe</h2>
        <p className="muted">Not linked. Add <code>COMPANIES_SUPABASE_URL</code> / <code>COMPANIES_SUPABASE_SERVICE_KEY</code> to <code>backend/.env</code>.</p>
      </div>
    )
  }

  return (
    <div className="pcard" style={{ marginTop: 18 }}>
      <div className="admin-head">
        <h2>Company universe {universe ? `(${universe.length})` : ''}</h2>
        <button className="primary" onClick={importAll} disabled={!!busy || !universe?.length}>
          Import all into platform →
        </button>
      </div>
      <p className="muted">The external intelligence DB of companies + their 12-skillset expectation bars. Import makes them real Talent Check targets across the app.</p>

      {universe === null && <p className="muted">Loading…</p>}
      {stats && (
        <>
          <div className="kpis" style={{ marginTop: 6 }}>
            <Tile label="Companies" value={universe.length} sub="in the universe" />
            <Tile label="Avg required level" value={`${stats.overall.toFixed(1)}/10`} sub="across all bars" />
            <Tile label="Top skillset" value={stats.demand[0]?.code} sub={catName(stats.demand[0]?.code)} />
            <Tile label="Toughest" value={stats.hardest[0]?.avg.toFixed(1)} sub={short(stats.hardest[0]?.name)} />
          </div>

          <div className="agrid" style={{ marginTop: 4 }}>
            <Card title="Most-demanded skillsets" sub="Average required level across all companies">
              <Bars items={stats.demand.map((d) => ({
                label: catName(d.code), value: Math.round((d.avg / stats.maxAvg) * 100),
                raw: d.avg.toFixed(1), color: catColor(d.code),
              }))} />
            </Card>
            <Card title="Toughest companies" sub="Highest overall hiring bar">
              <Bars items={stats.hardest.map((h) => ({
                label: short(h.name), value: Math.round((h.avg / 10) * 100),
                raw: h.avg.toFixed(1), color: 'var(--accent)',
              }))} />
            </Card>
          </div>
          {result && <p className="muted">Last import: {result.companies} companies · {result.bars} bars.</p>}
        </>
      )}
      {busy && <div className="busy">{busy}</div>}
    </div>
  )
}

const short = (s = '') => (s.length > 24 ? s.slice(0, 23) + '…' : s)
function Tile({ label, value, sub }) {
  return <div className="kpi"><div className="kl">{label}</div><div className="kv">{value}</div><div className="ks">{sub}</div></div>
}
function Card({ title, sub, children }) {
  return <div className="acard"><h3>{title}</h3>{sub && <div className="sub">{sub}</div>}{children}</div>
}
function Bars({ items }) {
  return (
    <div className="hbars">
      {items.map((it, i) => (
        <div className="hbar" key={i}>
          <span className="hl" title={it.label}>{it.label}</span>
          <span className="ht"><span className="hf" style={{ width: `${it.value}%`, background: it.color }} /></span>
          <span className="hv">{it.raw}</span>
        </div>
      ))}
    </div>
  )
}
