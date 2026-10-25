import { useState, type ChangeEvent, type FormEvent } from 'react'
import { AuthBrand, RolePicker } from './AuthParts'
import { useApp } from '../context/appContext'
import { DEMO_NAMES } from '../data/constants'

export function Login() {
  const { authRole, setRoute, login } = useApp()
  const [form, setForm] = useState({ id: '', email: '', password: '' })
  const isStudent = authRole === 'student'

  const field = (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    login(DEMO_NAMES[authRole], authRole)
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <AuthBrand onClick={() => setRoute('landing')} />
        <div className="auth-title">Welcome back</div>
        <p className="auth-sub">Log in to report and track residence issues.</p>
        <RolePicker />
        <form onSubmit={submit}>
          <div className="field">
            <label>{isStudent ? 'Student number' : 'Staff / Admin ID'}</label>
            <input
              type="text"
              value={form.id}
              onChange={field('id')}
              placeholder={isStudent ? 'e.g. 22045678' : 'e.g. STF-1042'}
              required
            />
          </div>
          <div className="field">
            <label>Email address</label>
            <input type="email" value={form.email} onChange={field('email')} placeholder="you@campus.ac.za" required />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={form.password} onChange={field('password')} placeholder="••••••••" required />
          </div>
          <button className="btn btn-primary btn-block" type="submit" style={{ marginTop: 6 }}>
            Log in
          </button>
        </form>
        {isStudent ? (
          <div className="auth-switch">
            Don’t have an account?{' '}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                setRoute('signup')
              }}
            >
              Sign up
            </a>
          </div>
        ) : (
          <div className="auth-switch">Staff accounts are created by the system administrator.</div>
        )}
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
