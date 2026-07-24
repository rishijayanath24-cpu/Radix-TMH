import Gauge from './Gauge'
import Icon from './Icon'
import { matchLabel } from '../lib/skills'

// One job-match card: company, role, circular % gauge, matched-skill checklist.
export default function MatchCard({ match, top, onClick }) {
  const checks = (match.matched_skills || []).slice(0, 3)
  const missing = (match.missing_skills || []).length
  return (
    <div className={`mcard ${top ? 'top' : ''}`} onClick={onClick}>
      <span className="arrow"><Icon name="arrowUpRight" size={15} /></span>
      <div className="co">{match.company || 'Company'}</div>
      <div className="role">{match.role || match.jd_source_file}</div>
      <div className="mid">
        <Gauge value={match.match_score} color={top ? '#f5451f' : '#cfd3da'} label={matchLabel(match.match_score)} />
        <div className="checks">
          {checks.map((c, i) => (
            <div className="c" key={i}><span className="tick"><Icon name="check" size={11} /></span>{c}</div>
          ))}
          {checks.length === 0 && <div className="c" style={{ color: '#b6bcc4' }}>No direct matches</div>}
          {missing > 0 && <div className="c" style={{ color: '#c0616b' }}>+{missing} to close</div>}
        </div>
      </div>
    </div>
  )
}
