import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState('email') // 'email' | 'code'
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSendCode = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({ email })
    setLoading(false)
    if (error) setError(error.message)
    else setStep('code')
  }

  const handleVerifyCode = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    })
    setLoading(false)
    if (error) setError(error.message)
    // On success, the auth listener in AuthContext picks up the new session automatically.
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Trading Journal</h1>
        {step === 'email' && (
          <>
            <p className="auth-sub">Enter your email to get a sign-in code.</p>
            <form onSubmit={handleSendCode}>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button type="submit" disabled={loading}>
                {loading ? 'Sending…' : 'Send code'}
              </button>
            </form>
          </>
        )}
        {step === 'code' && (
          <>
            <p className="auth-sub">Enter the code sent to {email}.</p>
            <form onSubmit={handleVerifyCode}>
              <input
                type="text"
                inputMode="numeric"
                required
                placeholder="6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <button type="submit" disabled={loading}>
                {loading ? 'Verifying…' : 'Verify & sign in'}
              </button>
            </form>
            <button
              type="button"
              className="auth-resend"
              onClick={() => {
                setStep('email')
                setCode('')
                setError(null)
              }}
            >
              Use a different email
            </button>
          </>
        )}
        {error && <p className="auth-error">{error}</p>}
      </div>
    </div>
  )
}
