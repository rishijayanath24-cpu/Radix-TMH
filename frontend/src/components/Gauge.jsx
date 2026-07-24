// Circular progress gauge (SVG) — the % ring on each match card.
export default function Gauge({ value = 0, size = 92, stroke = 8, color = '#f5451f', label }) {
  const v = Math.max(0, Math.min(100, value))
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - v / 100)
  return (
    <div className="gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef0f2" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.4,0,.2,1)' }}
        />
      </svg>
      <div className="val">
        <div className="n">{Math.round(v)}<small>%</small></div>
        {label && <div className="lbl">{label}</div>}
      </div>
    </div>
  )
}
