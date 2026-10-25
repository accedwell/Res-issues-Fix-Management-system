import { useState, type FormEvent } from 'react'
import { AuthBrand } from './AuthParts'
import { apiForgotPassword, apiResetPassword } from '../api'
import { PasswordInput } from '../components/PasswordInput'
import { useApp } from '../context/appContext'

type Step = 'email' | 'reset' | 'done'

export function ForgotPassword() {
  const { setRoute } = useApp()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [notice, setNotice] = useState('')
  const [devCode, setDevCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const requestCode = async (e?: FormEvent) => {
    e?.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await apiForgotPassword(email.trim())
      setNotice(res.message)
      setDevCode(res.devCode ?? '')
      setCode('')
      setStep('reset')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send a reset code.')
    } finally {
      setBusy(false)
    }
  }

  const resetPassword = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const res = await apiResetPassword(email.trim(), code.trim(), password)
      setNotice(res.message)
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset your password.')
    } finally {
      setBusy(false)
    }
  }

  const backToLogin = (
    <a
      className="back-home-link"
      href="#"
      onClick={(e) => {
        e.preventDefault()
        setRoute('login')
      }}
    >
      ← Back to log in
    </a>
  )

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <AuthBrand onClick={() => setRoute('landing')} />

        {step === 'email' && (
          <>
            <div className="auth-title">Forgot your password?</div>
            <p className="auth-sub">Enter the email address you use for ResiFix and we’ll send you a reset code.</p>
            <form onSubmit={requestCode}>
              <div className="field">
                <label htmlFor="forgot-email">Email address</label>
                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@campus.ac.za"
                  autoComplete="email"
                  required
                />
              </div>
              {error && <div className="field-error">{error}</div>}
              <button className="btn btn-primary btn-block" type="submit" style={{ marginTop: 6 }} disabled={busy}>
                {busy ? 'Sending…' : 'Send reset code'}
              </button>
            </form>
          </>
        )}

        {step === 'reset' && (
          <>
            <div className="auth-title">Choose a new password</div>
            <p className="auth-sub">{notice}</p>
            {devCode && (
              <div className="auth-notice">
                <b>Development mode:</b> email isn’t set up yet, so your reset code is <code>{devCode}</code>
              </div>
            )}
            <form onSubmit={resetPassword}>
              <div className="field">
                <label htmlFor="reset-code">Reset code</label>
                <input
                  id="reset-code"
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="6-digit code"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="reset-password">New password</label>
                <PasswordInput
                  id="reset-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <div className="field-hint">At least 8 characters.</div>
              </div>
              <div className="field">
                <label htmlFor="reset-confirm">Confirm new password</label>
                <PasswordInput
                  id="reset-confirm"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              {error && <div className="field-error">{error}</div>}
              <button className="btn btn-primary btn-block" type="submit" style={{ marginTop: 6 }} disabled={busy}>
                {busy ? 'Saving…' : 'Reset password'}
              </button>
            </form>
            <div className="auth-switch">
              Didn’t get a code?{' '}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  if (!busy) requestCode()
                }}
              >
                Send a new one
              </a>
            </div>
          </>
        )}

        {step === 'done' && (
          <>
            <div className="auth-title">Password changed</div>
            <p className="auth-sub">{notice}</p>
            <button className="btn btn-primary btn-block" onClick={() => setRoute('login')}>
              Log in
            </button>
          </>
        )}

        {step !== 'done' && backToLogin}
      </div>
    </div>
  )
}
