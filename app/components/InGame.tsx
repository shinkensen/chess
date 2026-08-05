"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Board } from "./Board";
import { RightDashboard } from "./RightDashboard";
import { useOnlineGame } from "./useOnlineGame";
import { Colour } from "./chess-engine";

export function InGame({ gameId }: { gameId: string }) {
  const router = useRouter();
  const {
    loading,
    error,
    row,
    gameState,
    myColor,
    myTurn,
    makeMove,
    doResign,
    status,
    finished,
  } = useOnlineGame(gameId);

  const [resignBusy, setResignBusy] = useState(false);

  const handleMove = useCallback(
    (r1: number, c1: number, r2: number, c2: number) => {
      makeMove(r1, c1, r2, c2);
    },
    [makeMove],
  );

  const handlePromotion = useCallback((_choice: string) => {
    // no-op: queen is auto-applied for online play
  }, []);

  if (loading) {
    return (
      <main style={mainStyle}>
        <div style={cardStyle}>Loading gameâ€¦</div>
      </main>
    );
  }

  if (error) {
    return (
      <main style={mainStyle}>
        <div style={cardStyle}>
          <div style={{ color: "#e84040", marginBottom: 12 }}>{error}</div>
          <button style={btnPrimary} onClick={() => router.push("/")}>
            Back to lobby
          </button>
        </div>
      </main>
    );
  }

  const statusText = (() => {
    if (finished) {
      if (status === "draw") return "Draw â€” pool split";
      const winner = status === "white_win" ? "White" : "Black";
      const youWon = myColor && dbWinnerIsMe(status, myColor);
      return `${winner} wins${youWon ? " â€” you won the pool! ðŸŽ‰" : ""}`;
    }
    if (row?.status === "open") return "Waiting for opponent to joinâ€¦";
    if (myTurn) return "Your turn";
    return "Opponent's turn";
  })();

  return (
    <main style={mainStyle}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={statusBanner(myTurn, finished)}>{statusText}</div>
        <Board
          gameState={gameState}
          onMove={handleMove}
          onPromotion={handlePromotion}
          interactive={myTurn && !finished}
          flipBoard={myColor === "B"}
        />
      </div>
      <RightDashboard
        row={row}
        myColor={myColor}
        myTurn={myTurn}
        status={status}
        finished={finished}
        gameId={gameId}
        onResign={async () => {
          setResignBusy(true);
          await doResign();
          setResignBusy(false);
        }}
        resignBusy={resignBusy}
        onLeave={() => router.push("/")}
      />
    </main>
  );
}

function dbWinnerIsMe(
  status: "open" | "active" | "white_win" | "black_win" | "draw" | "unknown",
  myColor: Colour,
): boolean {
  if (status === "white_win") return myColor === "W";
  if (status === "black_win") return myColor === "B";
  return false;
}

const mainStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#0e0e10",
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 24,
  padding: 24,
  fontFamily: "'Segoe UI', system-ui, sans-serif",
  color: "#fff",
  flexWrap: "wrap",
};

const cardStyle: React.CSSProperties = {
  background: "#1a1a1a",
  padding: 28,
  borderRadius: 16,
  border: "1px solid #333",
  textAlign: "center",
};

function statusBanner(myTurn: boolean, finished: boolean): React.CSSProperties {
  return {
    textAlign: "center",
    padding: "10px 16px",
    borderRadius: 10,
    fontWeight: 700,
    background: finished ? "#2a2a2a" : myTurn ? "#1e3a2a" : "#2a2a2a",
    border: finished
      ? "1px solid #444"
      : myTurn
        ? "2px solid #4f8"
        : "1px solid #444",
    color: myTurn && !finished ? "#9fffb0" : "#ddd",
  };
}

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