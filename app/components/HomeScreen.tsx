"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createAccount,
  getCurrentUser,
  signIn,
  signOut,
} from "../server/auth";
import {
  createGame,
  joinGame,
  listOpenGames,
  subscribeToLobby,
} from "../server/backend";
import type { GameRow } from "../server/types";
import { getSupabase } from "../utils/supabase";

type LocalUser = { id: string; email: string; gold: number } | null;

const GOLD = 500;

export function HomeScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const inviteGameId = params.get("joinGameId");

  const supabase = getSupabase();
  const [user, setUser] = useState<LocalUser>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // auth form
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authErr, setAuthErr] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  // lobby state
  const [games, setGames] = useState<GameRow[]>([]);
  const [bet, setBet] = useState<number>(50);
  const [joinBet, setJoinBet] = useState<number>(50);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [highlightGame, setHighlightGame] = useState<string | null>(
    inviteGameId,
  );
  const [configError] = useState<string | null>(
    supabase ? null : "Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_KEY in .env.local",
  );

  const refreshUser = useCallback(async () => {
    if (!supabase) {
      setUser(null);
      setLoadingUser(false);
      return;
    }
    const u = await getCurrentUser();
    setUser(u ? { id: u.id, email: u.email, gold: u.gold } : null);
    setLoadingUser(false);
  }, [supabase]);

  const loadGames = useCallback(async () => {
    if (!supabase) return;
    const open = await listOpenGames();
    const mine = open.filter((g) => g.player1?.player !== user?.id);
    setGames(mine);
  }, [supabase, user?.id]);

  // init: auth state + refresh user on auth changes
  useEffect(() => {
    if (!supabase) {
      setLoadingUser(false);
      return;
    }
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refreshUser();
    });
    refreshUser();
    return () => sub.subscription.unsubscribe();
  }, [supabase, refreshUser]);

  // lobby refresh
  useEffect(() => {
    loadGames();
    if (!supabase) return;
    const unsub = subscribeToLobby(() => loadGames());
    return unsub;
  }, [supabase, user?.id, loadGames]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthErr(null);
    setAuthBusy(true);
    const r = mode === "signin" ? await signIn(email, password) : await createAccount(email, password);
    setAuthBusy(false);
    if (!r.ok) {
      setAuthErr(r.error ?? "Authentication failed");
      return;
    }
    setEmail("");
    setPassword("");
    refreshUser();
  };

  const handleCreate = async () => {
    setErr(null);
    setBusy(true);
    const r = await createGame(bet);
    setBusy(false);
    if (!r.ok || !r.gameId) {
      setErr(r.error ?? "Failed to create game");
      return;
    }
    // copy shareable link to clipboard
    const url = `${window.location.origin}/?gameId=${r.gameId}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore
    }
    setHighlightGame(r.gameId);
    loadGames();
  };

  const handleJoin = async (g: GameRow) => {
    setErr(null);
    setBusy(true);
    const r = await joinGame(g.gameId, joinBet);
    setBusy(false);
    if (!r.ok) {
      setErr(r.error ?? "Failed to join game");
      return;
    }
    router.push(`/?gameId=${g.gameId}`);
  };

  if (configError) {
    return (
      <Shell gold={null} onSignOut={() => {}}>
        <Notice>{configError}</Notice>
      </Shell>
    );
  }

  if (loadingUser) {
    return (
      <Shell gold={null} onSignOut={() => {}}>
        <Notice>Loading…</Notice>
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell gold={null} onSignOut={() => {}}>
        <AuthCard
          mode={mode}
          setMode={setMode}
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          onSubmit={handleAuth}
          error={authErr}
          busy={authBusy}
        />
      </Shell>
    );
  }

  return (
    <Shell gold={user.gold} onSignOut={async () => { await signOut(); refreshUser(); }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 320 }}>
        <h2 style={{ margin: 0, color: "#fff" }}>Create a game</h2>
        <label style={{ color: "#ccc", display: "flex", flexDirection: "column", gap: 6 }}>
          Your bet (gold)
          <input
            type="number"
            min={1}
            max={user.gold}
            value={bet}
            onChange={(e) => setBet(Math.max(1, parseInt(e.target.value || "0", 10)))}
            style={inputStyle}
          />
          <span style={{ color: "#888", fontSize: 12 }}>
            Pool = 2 × min(your bet, opponent bet). You start with {GOLD} gold.
          </span>
        </label>
        <button style={btnPrimary} disabled={busy || bet > user.gold} onClick={handleCreate}>
          {busy ? "Creating…" : "Create game"}
        </button>
        {err && <span style={{ color: "#e84040" }}>{err}</span>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 360 }}>
        <h2 style={{ margin: 0, color: "#fff" }}>Open games — join to play</h2>
        {games.length === 0 && (
          <span style={{ color: "#888" }}>No open games. Create one and share the link!</span>
        )}
        {games.map((g) => (
          <div
            key={g.gameId}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "10px 14px",
              background: highlightGame === g.gameId ? "#2a3a2a" : "#2a2a2a",
              border: highlightGame === g.gameId ? "2px solid #4f8" : "1px solid #444",
              borderRadius: 10,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", color: "#ddd" }}>
              <span>
                Host bet: <b style={{ color: "#ffd66b" }}>{g.player1?.bet ?? 0} gold</b>
              </span>
              <span style={{ color: "#888", fontSize: 12 }}>
                Host plays {g.player1?.color}; pool {g.pool}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="number"
                min={1}
                value={joinBet}
                onChange={(e) => setJoinBet(Math.max(1, parseInt(e.target.value || "0", 10)))}
                style={{ ...inputStyle, width: 90 }}
              />
              <button
                style={btnPrimary}
                disabled={busy}
                onClick={() => handleJoin(g)}
              >
                Join
              </button>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #555",
  background: "#1a1a1a",
  color: "#fff",
  fontSize: 14,
};
const btnPrimary: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 8,
  border: "none",
  background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 14,
};

function Shell({
  gold,
  onSignOut,
  children,
}: {
  gold: number | null;
  onSignOut: () => void;
  children: React.ReactNode;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0e0e10",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: 32,
        padding: "40px 20px",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        color: "#fff",
      }}
    >
      <header
        style={{
          width: "100%",
          maxWidth: 960,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h1 style={{ margin: 0, fontWeight: 800, letterSpacing: 1 }}>
          ♟️ ChessBets
        </h1>
        {gold !== null && (
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                background: "#1a1a1a",
                border: "1px solid #444",
                color: "#ffd66b",
                fontWeight: 700,
              }}
            >
              🪙 {gold} gold
            </span>
            <button
              onClick={onSignOut}
              style={{ ...btnPrimary, background: "#333" }}
            >
              Sign out
            </button>
          </div>
        )}
      </header>
      <section
        style={{
          width: "100%",
          maxWidth: 960,
          display: "flex",
          flexWrap: "wrap",
          gap: 28,
          alignItems: "flex-start",
        }}
      >
        {children}
      </section>
    </main>
  );
}

function AuthCard({
  mode,
  setMode,
  email,
  setEmail,
  password,
  setPassword,
  onSubmit,
  error,
  busy,
}: {
  mode: "signin" | "signup";
  setMode: (m: "signin" | "signup") => void;
  email: string;
  setEmail: (s: string) => void;
  password: string;
  setPassword: (s: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  error: string | null;
  busy: boolean;
}) {
  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        minWidth: 340,
        background: "#1a1a1a",
        padding: 28,
        borderRadius: 16,
        border: "1px solid #333",
      }}
    >
      <h2 style={{ margin: 0, color: "#fff" }}>
        {mode === "signin" ? "Sign in" : "Create account"} — get 500 🪙
      </h2>
      <div style={{ display: "flex", gap: 8 }}>
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              background: mode === m ? "#4f46e5" : "#2a2a2a",
              color: "#fff",
              fontWeight: 600,
            }}
          >
            {m === "signin" ? "Sign in" : "Sign up"}
          </button>
        ))}
      </div>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={inputStyle}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={inputStyle}
        required
        minLength={6}
      />
      {error && <span style={{ color: "#e84040" }}>{error}</span>}
      <button type="submit" style={btnPrimary} disabled={busy}>
        {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
      </button>
      <span style={{ color: "#888", fontSize: 12 }}>
        Sign up grants you 500 starting gold. Bet gold on games — winner takes the pool.
      </span>
    </form>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: "#ddd", background: "#1a1a1a", padding: 28, borderRadius: 16 }}>
      {children}
    </div>
  );
}
