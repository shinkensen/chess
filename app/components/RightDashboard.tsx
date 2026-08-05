"use client";
import { useState } from "react";
import type { GameRow } from "../server/types";
import { Colour } from "./chess-engine";

interface RightDashboardProps {
  row: GameRow | null;
  myColor: Colour | null;
  myTurn: boolean;
  status: "open" | "active" | "white_win" | "black_win" | "draw" | "unknown";
  finished: boolean;
  gameId: string;
  onResign: () => void;
  resignBusy: boolean;
  onLeave: () => void;
}

export function RightDashboard({
  row,
  myColor,
  myTurn,
  status,
  finished,
  gameId,
  onResign,
  resignBusy,
  onLeave,
}: RightDashboardProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/?gameId=${gameId}`
      : "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  if (!row) {
    return (
      <div style={panelStyle}>
        <h2 style={{ margin: 0, color: "#fff" }}>Game</h2>
        <p style={{ color: "#888" }}>Loading...</p>
      </div>
    );
  }

  const p1 = row.player1;
  const p2 = row.player2;
  const youP1 = myColor && p1 && dbColor(p1.color) === myColor;
  const winnerLabel =
    status === "white_win"
      ? "White wins"
      : status === "black_win"
        ? "Black wins"
        : status === "draw"
          ? "Draw"
          : null;

  return (
    <div style={panelStyle}>
      <h2 style={{ margin: 0, color: "#fff", marginBottom: 12 }}>Game</h2>
      <Row label="Pool">
        <span style={{ color: "#ffd66b", fontWeight: 700 }}>Coin {row.pool} gold</span>
      </Row>
      <Row label="Status">
        <span style={{ color: finished ? "#9fffb0" : "#ddd" }}>
          {finished
            ? winnerLabel ?? "Finished"
            : row.status === "open"
              ? "Waiting for opponent"
              : myTurn
                ? "Your turn"
                : "Opponent turn"}
        </span>
      </Row>
      <Row label="You play">
        <span style={{ color: "#fff" }}>
          {myColor ? (myColor === "W" ? "White" : "Black") : "-"}
        </span>
      </Row>
      <div style={{ height: 1, background: "#333", margin: "12px 0" }} />
      <h3 style={{ margin: "0 0 8px", color: "#ccc", fontSize: 13 }}>Players</h3>
      <PlayerLine color="white" bet={p1.color === "white" ? p1.bet : p2?.color === "white" ? p2.bet : 0} isYou={!!youP1} ready={!!p2} />
      <PlayerLine color="black" bet={p1.color === "black" ? p1.bet : p2?.color === "black" ? p2.bet : 0} isYou={!youP1 && !!myColor} ready={!!p2} />
      <div style={{ height: 1, background: "#333", margin: "12px 0" }} />
      <h3 style={{ margin: "0 0 8px", color: "#ccc", fontSize: 13 }}>Share link</h3>
      <button style={linkBtn} onClick={copyLink}>{copied ? "Copied!" : "Copy invite link"}</button>
      <div style={{ fontSize: 11, color: "#666", marginTop: 4, wordBreak: "break-all", maxHeight: 40, overflow: "auto" }}>{shareUrl}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button style={{ ...btn, background: "#7a1f1f" }} disabled={resignBusy || finished || row.status !== "active" || !myColor} onClick={onResign}>{resignBusy ? "Resigning..." : "Resign"}</button>
        <button style={{ ...btn, background: "#333" }} onClick={onLeave}>Leave</button>
      </div>
    </div>
  );
}

function dbColor(c: string): Colour { return c === "white" ? "W" : "B"; }

function PlayerLine({ color, bet, isYou, ready }: { color: "white" | "black"; bet: number; isYou: boolean; ready: boolean; }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", borderRadius: 6, background: "#151515", marginBottom: 6 }}>
      <span style={{ color: "#fff" }}>{color === "white" ? "K White" : "K Black"}{isYou && <span style={{ color: "#ffd66b", marginLeft: 6 }}>(you)</span>}</span>
      <span style={{ color: "#ddd", fontSize: 13 }}>{ready ? `${bet} coin` : "-"}</span>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
      <span style={{ color: "#888", fontSize: 13 }}>{label}</span>
      {children}
    </div>
  );
}

const panelStyle: React.CSSProperties = { width: 260, padding: 20, borderRadius: 16, background: "#1a1a1a", border: "1px solid #333", display: "flex", flexDirection: "column", fontFamily: "'Segoe UI', system-ui, sans-serif" };
const btn: React.CSSProperties = { flex: 1, padding: "10px 12px", borderRadius: 8, border: "none", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 };
const linkBtn: React.CSSProperties = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #555", background: "#2a2a2a", color: "#fff", cursor: "pointer", fontSize: 13 };
