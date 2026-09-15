'use client';

import { useState } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';

export default function Auth({ onClose }: { onClose: () => void }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    const supabase = createBrowserClient();
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName || email.split('@')[0] } },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage('Check your email to confirm your account, then sign in.');
          setIsSignUp(false);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="dialog-close" onClick={onClose} aria-label="Close">×</button>
        <div className="eyebrow">PLAY-MONEY MARKET</div>
        <h1 id="auth-title">{isSignUp ? 'Create your account' : 'Welcome back'}</h1>
        <p className="muted">{isSignUp ? 'Start with 10,000 credits. They have no cash value.' : 'Sign in to quote, buy, and sell outcome shares.'}</p>
        <form onSubmit={submit} className="auth-form">
          {isSignUp && <label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={32} required /></label>}
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={isSignUp ? 'new-password' : 'current-password'} minLength={6} required /></label>
          {message && <div className="notice" role="status">{message}</div>}
          <button className="button button-primary button-block" disabled={loading}>{loading ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}</button>
        </form>
        <button className="auth-switch" onClick={() => { setIsSignUp((value) => !value); setMessage(''); }}>
          {isSignUp ? 'Already registered? Sign in' : 'New to BetChess? Create an account'}
        </button>
      </section>
    </div>
  );
}
