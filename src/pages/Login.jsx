import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
    })
    setLoading(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Trading Journal</h1>
        <p className="auth-sub">Sign in with a magic link — no password needed.</p>
        {sent ? (
          <p className="auth-success">Check your email for a sign-in link.</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" disabled={loading}>
              {loading ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        )}
        {error && <p className="auth-error">{error}</p>}
      </div>
    </div>
  )
}
