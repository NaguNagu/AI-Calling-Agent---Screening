import { useState } from 'react'
import Icon from '../components/Icon'
import { Button, Field } from '../components/ui'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const signIn = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) setError(authError.message === 'Invalid login credentials' ? 'That email and password don’t match. Please try again.' : authError.message)
    } catch {
      setError('We couldn’t reach the server. Check your internet connection, or that the Supabase project is running.')
    }
    setBusy(false)
  }

  return (
    <main className="login">
      <section className="login-side">
        <div className="brand brand-light"><span className="brand-mark">K</span><span><b>Kural AI</b><small>AI screening studio</small></span></div>
        <div className="login-pitch">
          <h1>Screen every candidate with a friendly phone call.</h1>
          <p>Kural AI calls your candidates in English, Tamil or Hindi, asks your screening questions, and puts their answers in one place.</p>
          <ul>
            <li><Icon name="phone" size={16} />Calls hundreds of candidates for you</li>
            <li><Icon name="globe" size={16} />Speaks English, Tamil and Hindi</li>
            <li><Icon name="star" size={16} />You review the answers and shortlist</li>
          </ul>
        </div>
        <small className="login-foot">© {new Date().getFullYear()} Kural AI</small>
      </section>
      <section className="login-main">
        <form className="login-form" onSubmit={signIn}>
          <div className="brand login-brand-mobile"><span className="brand-mark">K</span><span><b>Kural AI</b><small>AI screening studio</small></span></div>
          <h2>Sign in</h2>
          <p className="muted">Welcome back. Enter your work email to continue.</p>
          <Field label="Email address"><input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required autoFocus /></Field>
          <Field label="Password"><input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" required /></Field>
          {error && <div className="alert"><Icon name="alert" size={16} />{error}</div>}
          <Button variant="primary" size="lg" type="submit" className="full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
          <p className="muted small center"><Icon name="lock" size={13} /> Private workspace. Ask your admin if you need access.</p>
        </form>
      </section>
    </main>
  )
}
