import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'

// Supabase OTP codes are numeric and can be configured anywhere from 6-10 digits
// (Authentication > Sign In / Providers > Email > Email OTP Length in the dashboard).
// We don't hardcode a length here so the form keeps working regardless of that setting.
const MAX_OTP_LENGTH = 10
const MIN_OTP_LENGTH = 6

export default function Login() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState('email') // 'email' | 'code'
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const autoSubmitted = useRef(false)

  const handleSendCode = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({ email })
    setLoading(false)
    if (error) setError(error.message)
    else setStep('code')
  }

  const verifyCode = async (codeValue) => {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: codeValue,
      type: 'email',
    })
    setLoading(false)
    if (error) {
      setError(error.message)
      autoSubmitted.current = false // allow retry on a corrected code
    }
    // On success, the auth listener in AuthContext picks up the new session automatically.
  }

  const handleVerifyCode = async (e) => {
    e.preventDefault()
    verifyCode(code)
  }

  const handleCodeChange = (e) => {
    // Only allow digits, cap at the max Supabase allows (10)
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, MAX_OTP_LENGTH)
    setCode(digitsOnly)
  }

  // Auto-submit once the code reaches the minimum plausible length (6) and
  // the field has stopped changing for a moment, in case the code is longer.
  useEffect(() => {
    if (code.length < MIN_OTP_LENGTH || loading || autoSubmitted.current) return
    const timer = setTimeout(() => {
      autoSubmitted.current = true
      verifyCode(code)
    }, 300) // brief pause so a longer code can finish being typed/pasted first
    return () => clearTimeout(timer)
  }, [code]) // eslint-disable-line react-hooks/exhaustive-deps

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
                pattern="[0-9]*"
                autoComplete="one-time-code"
                required
                maxLength={MAX_OTP_LENGTH}
                placeholder="Sign-in code"
                value={code}
                onChange={handleCodeChange}
              />
              <button type="submit" disabled={loading || code.length < MIN_OTP_LENGTH}>
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
                autoSubmitted.current = false
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
