// "Growth" area chart (SVG). Decorative but markers are driven by props.
export default function RadialChart({ markers = ['10k+', '60k+', '100k+'] }) {
  const W = 384, H = 210, base = 176
  const curve = `M6 ${base} C 66 ${base}, 92 132, 150 94 S 250 14, 300 44 S 362 118, 378 150`
  const area = `${curve} L378 ${base} L6 ${base} Z`
  const pts = [
    { x: 92, y: 122, t: markers[0] },
    { x: 206, y: 62, t: markers[1] },
    { x: 296, y: 40, t: markers[2] },
  ]
  const gridY = [base, base - 42, base - 84, base - 126]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4322" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#ef4322" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="stroke" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#ef4322" />
          <stop offset="100%" stopColor="#ff7a45" />
        </linearGradient>
      </defs>

      {/* faint horizontal gridlines */}
      {gridY.map((y, i) => (
        <line key={i} x1="6" y1={y} x2="378" y2={y} stroke="#eeece8" strokeWidth="1" />
      ))}

      <path d={area} fill="url(#fill)" />
      <path d={curve} fill="none" stroke="url(#stroke)" strokeWidth="2.4" strokeLinecap="round" />

      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="8" fill="#ef4322" opacity="0.12" />
          <circle cx={p.x} cy={p.y} r="3.4" fill="#fff" stroke="#ef4322" strokeWidth="2.2" />
          <text x={p.x} y={p.y - 13} textAnchor="middle" fontSize="11.5" fontWeight="600"
            fill="#1a1d23" style={{ fontVariantNumeric: 'tabular-nums' }}>{p.t}</text>
        </g>
      ))}
    </svg>
  )
}
