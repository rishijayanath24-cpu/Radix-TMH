import { useState } from 'react'
import { useAuth } from '../lib/auth'

export default function AuthModal({ onClose }) {
  const { signIn, signUp } = useAuth()
  const [tab, setTab] = useState('in')          // 'in' | 'up'
  const [role, setRole] = useState('candidate')  // candidate | employer
  const [form, setForm] = useState({ full_name: '', email: '', password: '' })
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setMsg(''); setBusy(true)
    try {
      if (tab === 'in') {
        await signIn({ email: form.email, password: form.password })
        onClose()
      } else {
        const data = await signUp({ ...form, role })
        if (data?.session) onClose()
        else { setMsg('Account created. If email confirmation is on, confirm then sign in.'); setTab('in') }
      }
    } catch (ex) {
      setErr(ex.message || 'Something went wrong')
    } finally { setBusy(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="logo sm">R</div>
          <b>RADIX Talent Match</b>
          <span className="close" onClick={onClose}>×</span>
        </div>

        <div className="tabs">
          <button className={tab === 'in' ? 'on' : ''} onClick={() => setTab('in')}>Sign in</button>
          <button className={tab === 'up' ? 'on' : ''} onClick={() => setTab('up')}>Create account</button>
        </div>

        <form onSubmit={submit} className="form">
          {tab === 'up' && (
            <>
              <label>I want to…</label>
              <div className="seg">
                <button type="button" className={role === 'candidate' ? 'on' : ''} onClick={() => setRole('candidate')}>Find a job</button>
                <button type="button" className={role === 'employer' ? 'on' : ''} onClick={() => setRole('employer')}>Hire talent</button>
              </div>
              <label>Full name</label>
              <input value={form.full_name} onChange={set('full_name')} placeholder="Ada Lovelace" required />
            </>
          )}
          <label>Email</label>
          <input type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" required />
          <label>Password</label>
          <input type="password" value={form.password} onChange={set('password')} placeholder="••••••••" minLength={6} required />

          {err && <div className="err">{err}</div>}
          {msg && <div className="ok">{msg}</div>}

          <button className="primary" disabled={busy} type="submit">
            {busy ? 'Please wait…' : tab === 'in' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}
