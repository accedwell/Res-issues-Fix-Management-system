import { useState, type ChangeEvent, type FormEvent } from 'react'
import { AuthBrand } from './AuthParts'
import { useApp } from '../context/appContext'
import { BLOCKS } from '../data/constants'

export function Signup() {
  const { setRoute, login } = useApp()
  const [form, setForm] = useState({
    first: '', last: '', id: '', email: '', block: BLOCKS[0], room: '', password: '', confirm: '',
  })
  const [error, setError] = useState('')

  const field = (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [key]: e.target.value })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirm) {
      setError('Passwords do not match.')
      return
    }
    // Only students register themselves; staff accounts are created by the system administrator.
    login(form.first + ' ' + form.last, 'student')
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <AuthBrand onClick={() => setRoute('landing')} />
        <div className="auth-title">Create your student account</div>
        <p className="auth-sub">Join ResiFix to start reporting and tracking residence issues.</p>
        <form onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="field">
              <label>First name</label>
              <input type="text" value={form.first} onChange={field('first')} required />
            </div>
            <div className="field">
              <label>Surname</label>
              <input type="text" value={form.last} onChange={field('last')} required />
            </div>
          </div>
          <div className="field">
            <label>Student number</label>
            <input
              type="text"
              value={form.id}
              onChange={field('id')}
              placeholder="e.g. 22045678"
              required
            />
          </div>
          <div className="field">
            <label>Email address</label>
            <input type="email" value={form.email} onChange={field('email')} placeholder="you@campus.ac.za" required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="field">
              <label>Block</label>
              <select value={form.block} onChange={field('block')} required>
                {BLOCKS.map((block) => (
                  <option key={block} value={block}>
                    {block}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Room number</label>
              <input type="text" value={form.room} onChange={field('room')} placeholder="e.g. 204" required />
            </div>
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={form.password} onChange={field('password')} required />
          </div>
          <div className="field">
            <label>Confirm password</label>
            <input type="password" value={form.confirm} onChange={field('confirm')} required />
          </div>
          {error && <div className="field-error">{error}</div>}
          <button className="btn btn-primary btn-block" type="submit" style={{ marginTop: 6 }}>
            Create account
          </button>
        </form>
        <div className="auth-switch">
          Already have an account?{' '}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              setRoute('login')
            }}
          >
            Log in
          </a>
        </div>
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
