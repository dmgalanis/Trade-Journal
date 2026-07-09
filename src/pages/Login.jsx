import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'

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
    // Only allow digits, cap at 6
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6)
    setCode(digitsOnly)
  }

  // Auto-submit as soon as 6 digits are entered
  useEffect(() => {
    if (code.length === 6 && !loading && !autoSubmitted.current) {
      autoSubmitted.current = true
      verifyCode(code)
    }
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
                maxLength={6}
                placeholder="6-digit code"
                value={code}
                onChange={handleCodeChange}
              />
              <button type="submit" disabled={loading || code.length !== 6}>
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
