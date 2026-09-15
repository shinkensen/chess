'use client';

import Link from 'next/link';
import { useState } from 'react';
import Auth from './Auth';
import { useAuth } from './AuthProvider';

export default function SiteHeader() {
  const { user, loading, signOut } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

  return (
    <>
      <header className="site-header">
        <div className="shell header-inner">
          <Link href="/" className="brand" aria-label="BetChess home">
            <span className="brand-mark" aria-hidden="true">♞</span>
            <span>BetChess</span>
          </Link>
          <div className="play-credit-badge">
            <span className="live-dot" aria-hidden="true" />
            10,000 play credits · no cash value
          </div>
          <div className="header-account">
            {loading ? <span className="muted">Checking session…</span> : user ? (
              <>
                <span className="account-email">{user.email}</span>
                <button className="button button-quiet" onClick={() => void signOut()}>Sign out</button>
              </>
            ) : (
              <button className="button button-primary" onClick={() => setShowAuth(true)}>Sign in to trade</button>
            )}
          </div>
        </div>
      </header>
      {showAuth && <Auth onClose={() => setShowAuth(false)} />}
    </>
  );
}
