import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function Register() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const navigate                = useNavigate()

  const handleEmail = async (e) => {
    e.preventDefault()
    if (!email || !password) return toast.error('Please fill all fields')
    if (password.length < 6) return toast.error('Password must be at least 6 characters')
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin + '/dashboard' }
    })
    setLoading(false)
    if (error) {
      if (error.message.includes('already')) toast.error('Email already registered — sign in instead')
      else toast.error(error.message)
    } else {
      toast.success('Check your email to confirm your account')
      navigate('/login')
    }
  }

  const handleGoogle = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/dashboard' },
    })
    if (error) { toast.error('Google sign-in failed'); setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="flex items-center gap-2 no-underline mb-10 justify-center">
          <div className="w-7 h-7 bg-ink rounded-lg flex items-center justify-center">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span className="text-sm font-semibold text-ink">HSCR Design Tools</span>
        </Link>

        <h1 className="text-[22px] font-bold text-ink tracking-tight mb-1">Create your account</h1>
        <p className="text-[13.5px] text-muted mb-8">Free forever. No credit card required.</p>

        <button onClick={handleGoogle} disabled={loading}
          className="w-full flex items-center justify-center gap-2.5 border border-line
                     rounded-lg py-2.5 text-[13.5px] text-ink font-medium
                     hover:bg-neutral-50 transition-colors duration-150 mb-4 bg-white cursor-pointer">
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-line" />
          <span className="text-[11.5px] text-muted">or</span>
          <div className="flex-1 h-px bg-line" />
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          <div>
            <label className="block text-[12px] font-medium text-ink mb-1.5">Email address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" className="input-field" />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-ink mb-1.5">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Min. 6 characters" className="input-field" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-[13.5px] mt-1">
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-[12.5px] text-muted text-center mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-ink font-medium no-underline hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
