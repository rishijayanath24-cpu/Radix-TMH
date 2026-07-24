import { Link, useNavigate } from 'react-router-dom'

export default function Landing() {
  const nav = useNavigate()
  return (
    <div className="landing">
      <video className="auth-video" autoPlay muted loop playsInline preload="auto">
        <source src="/landing-hero.mp4" type="video/mp4" />
      </video>
      <div className="landing-overlay" />

      <header className="landing-nav">
        <div className="brand">
          <div className="logo logo-video">
            <video autoPlay muted loop playsInline preload="auto">
              <source src="/logo-animation.mp4" type="video/mp4" />
            </video>
          </div>
          <b className="lbrand">RADIX Talent Match</b>
        </div>
        <div className="lnav-actions">
          <Link to="/app" className="lnav-link">Live demo</Link>
          <Link to="/login/employer" className="lnav-link">For employers</Link>
          <button className="cta small" onClick={() => nav('/login/candidate')}>Sign in</button>
        </div>
      </header>

      <main className="landing-hero split">
        <div className="hero-copy">
          <span className="pill light">AI-Powered · 12-skillset framework</span>
          <h1>Know if you're<br /><span className="accent">actually ready</span><br />for the job.</h1>
          <p>Upload a JD or résumé, build your profile, and see your readiness score and
            exact skill gaps — matched against real company hiring bars.</p>

          <div className="cta-row">
            <button className="cta primary" onClick={() => nav('/login/candidate')}>Find a job →</button>
            <button className="cta ghost-light" onClick={() => nav('/login/employer')}>Hire talent</button>
          </div>
          <Link to="/app" className="explore">or explore the live demo without an account →</Link>
        </div>
      </main>

      <footer className="landing-foot">
        <span>Coding · DSA · OOD · Aptitude · Communication · AI · Cloud · SQL · SWE · System Design · Networking · OS</span>
      </footer>
    </div>
  )
}
