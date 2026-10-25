import { useState, type ChangeEvent, type FormEvent } from 'react'
import { AuthBrand } from './AuthParts'
import { apiLogin } from '../api'
import { useApp } from '../context/appContext'

export function Login() {
  const { setRoute, login } = useApp()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const field = (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value })

  // The account decides the role, so everyone uses the same form.
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const user = await apiLogin(form.email.trim(), form.password)
      login(user.name, user.role, user.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.')
      setBusy(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <AuthBrand onClick={() => setRoute('landing')} />
        <div className="auth-title">Welcome back</div>
        <p className="auth-sub">Log in to report and track residence issues.</p>
        <form onSubmit={submit}>
          <div className="field">
            <label>Email address</label>
            <input
              type="email"
              value={form.email}
              onChange={field('email')}
              placeholder="you@campus.ac.za"
              autoComplete="email"
              required
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={form.password}
              onChange={field('password')}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>
          {error && <div className="field-error">{error}</div>}
          <button className="btn btn-primary btn-block" type="submit" style={{ marginTop: 6 }} disabled={busy}>
            {busy ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        <div className="auth-switch">
          New student?{' '}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              setRoute('signup')
            }}
          >
            Create an account
          </a>
        </div>
        <p className="auth-switch" style={{ marginTop: 6, fontSize: 12 }}>
          Staff accounts are created by the system administrator.
        </p>
        <a
          className="back-home-link"
          href="#"
          onClick={(e) => {
            e.preventDefault()
            setRoute('landing')
          }}
        >
          ← Back to home
        </a>
      </div>
    </div>
  )
}
