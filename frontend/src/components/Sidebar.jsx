// Left sidebar nav — auto-hides off-screen, slides in when the cursor nears
// the far-left edge (the thin accent strip hints it's there). Holds the
// top-level Candidate / Employer / Admin mode switch and, in Candidate mode,
// the sub-tabs for each candidate-facing screen.
const ROLE_BADGE = { candidate: 'Candidate account', employer: 'Employer account', admin: 'Admin account' }

const CANDIDATE_TABS = [
  { v: 'dashboard', label: 'Dashboard' },
  { v: 'talentcheck', label: 'Talent Check' },
  { v: 'profile', label: 'My Profile' },
  { v: 'explore', label: 'Explore Companies' },
]

export default function Sidebar({ mode, setMode, subTab, setSubTab, user, profile, role, onSignIn, onSignOut, onBrandClick }) {
  return (
    <>
      <div className="sidebar-edge" />
      <div className="sidebar-zone" />
      <aside className="sidebar-aside">
        <div className="sb-brand" onClick={onBrandClick}>
          <div className="sb-logo">R</div>
          <div>
            <div className="sb-name">RADIX</div>
            <div className="sb-sub">Talent Match</div>
          </div>
        </div>

        <div className="sb-hr" />

        <div className="sb-section">
          <div className="sb-heading">Mode</div>
          <button className={`sb-item${mode === 'candidate' ? ' on' : ''}`} onClick={() => setMode('candidate')}>Candidate</button>
          <button className={`sb-item${mode === 'employer' ? ' on' : ''}`} onClick={() => setMode('employer')}>Employer</button>
          <button className={`sb-item${mode === 'admin' ? ' on' : ''}`} onClick={() => setMode('admin')}>Admin</button>
        </div>

        {mode === 'candidate' && (
          <div className="sb-section">
            <div className="sb-heading">Candidate</div>
            {CANDIDATE_TABS.map((t) => (
              <button key={t.v} className={`sb-item${subTab === t.v ? ' on' : ''}`} onClick={() => setSubTab(t.v)}>{t.label}</button>
            ))}
          </div>
        )}

        <div className="sb-foot">
          {user ? (
            <div className="sb-user">
              <div className="sb-av">{(profile?.full_name || user.email || '?')[0].toUpperCase()}</div>
              <div className="sb-uinfo">
                <b>{profile?.full_name || user.email.split('@')[0]}</b>
                <span>{ROLE_BADGE[role] || 'Candidate account'}</span>
              </div>
              <button className="sb-signout" onClick={onSignOut} title="Sign out">↪</button>
            </div>
          ) : (
            <button className="sb-item sb-signin" onClick={onSignIn}>Sign in</button>
          )}
        </div>
      </aside>
    </>
  )
}
