import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { hasSupabase } from '../lib/supabase'
import { DEMO_ACCOUNTS, ROLE_COPY } from '../lib/demo'

const ROLES = ['candidate', 'employer', 'admin']

export default function Login() {
  const params = useParams()
  const role = ROLES.includes(params.role) ? params.role : 'candidate'
  const demo = DEMO_ACCOUNTS[role]
  const copy = ROLE_COPY[role]

  const { signIn, signUp, user } = useAuth()
  const nav = useNavigate()

  const [tab, setTab] = useState('in')  // 'in' | 'up' (admin: sign-in only)
  const [form, setForm] = useState({ full_name: '', email: demo.email, password: demo.password })
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  // reset prefilled creds when switching role
  useEffect(() => {
    setForm({ full_name: '', email: demo.email, password: demo.password }); setErr(''); setMsg('')
  }, [role])

  // already signed in → go to the app
  useEffect(() => { if (user) nav('/app') }, [user])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const friendly = (m = '') => {
    if (/rate limit|over_email_send/i.test(m))
      return 'Email rate limit hit. In Supabase, turn OFF "Confirm email" (Authentication → Sign In/Providers → Email), or add this user via Authentication → Users.'
    if (/already registered|already been/i.test(m)) return 'This account already exists — switch to Sign in.'
    if (/invalid login/i.test(m)) return 'Wrong email or password (or the demo user isn\'t created in Supabase yet).'
    if (/confirm/i.test(m)) return 'Email not confirmed. Turn OFF "Confirm email" in Supabase, or confirm the user.'
    return m || 'Something went wrong'
  }

  async function submit(e) {
    e.preventDefault(); setErr(''); setMsg(''); setBusy(true)
    try {
      if (!hasSupabase) { setErr('Supabase not linked — add keys to frontend/.env.'); return }
      if (tab === 'in') { await signIn({ email: form.email, password: form.password }); nav('/app') }
      else {
        const data = await signUp({ ...form, role })
        if (data?.session) nav('/app')
        else { setMsg('Account created. If "Confirm email" is on, disable it in Supabase, then sign in.'); setTab('in') }
      }
    } catch (ex) { setErr(friendly(ex.message)) } finally { setBusy(false) }
  }

  return (
    <div className="auth-page">
      {/* left brand panel with the video */}
      <div className={`auth-brand role-${role}`}>
        <video className="auth-video" autoPlay muted loop playsInline preload="auto">
          <source src="/landing.mp4" type="video/mp4" />
        </video>
        <div className="auth-brand-overlay" />
        <div className="auth-brand-inner">
          <Link to="/" className="brand light"><div className="logo">R</div><b>RADIX Talent Match</b></Link>
          <div>
            <h2>{copy.title}</h2>
            <p>{copy.blurb}</p>
          </div>
          <div className="role-switch">
            {ROLES.map((r) => (
              <Link key={r} to={`/login/${r}`} className={r === role ? 'on' : ''}>{DEMO_ACCOUNTS[r].label}</Link>
            ))}
          </div>
        </div>
      </div>

      {/* right form */}
      <div className="auth-form-side">
        <div className="auth-card">
          <div className="auth-role-tag">{demo.label} portal</div>
          <h1>{tab === 'in' ? 'Sign in' : 'Create account'}</h1>

          {role !== 'admin' && (
            <div className="tabs">
              <button className={tab === 'in' ? 'on' : ''} onClick={() => setTab('in')}>Sign in</button>
              <button className={tab === 'up' ? 'on' : ''} onClick={() => setTab('up')}>Create account</button>
            </div>
          )}

          <form onSubmit={submit} className="form">
            {tab === 'up' && (
              <>
                <label>Full name</label>
                <input value={form.full_name} onChange={set('full_name')} placeholder="Your name" required />
              </>
            )}
            <label>Email</label>
            <input type="email" value={form.email} onChange={set('email')} required />
            <label>Password</label>
            <input type="password" value={form.password} onChange={set('password')} minLength={6} required />

            {err && <div className="err">{err}</div>}
            {msg && <div className="ok">{msg}</div>}

            <button className="primary" disabled={busy} type="submit">
              {busy ? 'Please wait…' : tab === 'in' ? `Sign in as ${demo.label}` : `Create ${demo.label} account`}
            </button>
          </form>

          <div className="demo-hint">
            Demo credentials prefilled · <code>{demo.email}</code>
          </div>
          <Link to="/app" className="explore dark">Skip — explore the live demo →</Link>
        </div>
      </div>
    </div>
  )
}
