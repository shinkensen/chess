"use client";
import { useState, useCallback } from "react";
import { Square } from "./Square";
import { PieceIcon } from "./Pieces";
import {
  legalMoves,
  MovegenOpts,
  colourOf,
} from "./chess-engine";
import type { GameState } from "./Game";
interface BoardProps {
  gameState: GameState;
  onMove: (r1: number, c1: number, r2: number, c2: number) => void;
  onPromotion: (choice: string) => void;
}
export const Board = ({ gameState, onMove, onPromotion }: BoardProps) => {
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [hints, setHints] = useState<[number, number][]>([]);

  const { board, turn, enPassantTarget, castlingRights, status, pendingPromotion } = gameState;
  const opts: MovegenOpts = { enPassantTarget };

  const handleSquareClick = useCallback((r: number, c: number) => {
    if (status === "checkmate" || status === "stalemate") return;

    const piece = board[r][c];
    if (selected) {
      const [sr, sc] = selected;
      if (hints.some(([hr, hc]) => hr === r && hc === c)) {
        onMove(sr, sc, r, c);
        setSelected(null);
        setHints([]);
        return;
      }
    }
    if (piece && colourOf(piece) === turn) {
      if (selected && selected[0] === r && selected[1] === c) {
        setSelected(null);
        setHints([]);
      } else {
        setSelected([r, c]);
        const moves = legalMoves(board, r, c, opts, castlingRights);
        setHints(moves);
      }
      return;
    }
    setSelected(null);
    setHints([]);
  }, [board, turn, selected, hints, opts, castlingRights, status, onMove]);
  let checkSquare: [number, number] | null = null;
  if (status === "check" || status === "checkmate") {
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (board[r][c] === "K" + turn) checkSquare = [r, c];
  }

  const squares: React.ReactNode[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const light = (r + c) % 2 === 0;
      const isSelected = selected !== null && selected[0] === r && selected[1] === c;
      const isHint = hints.some(([hr, hc]) => hr === r && hc === c);
      const isCheck = checkSquare !== null && checkSquare[0] === r && checkSquare[1] === c;
      const piece = board[r][c];
      squares.push(
        <div key={r * 8 + c} style={{ width: "100%", height: "100%" }}>
          <Square
            light={light}
            selected={isSelected}
            hint={isHint}
            check={isCheck}
            onSelect={() => handleSquareClick(r, c)}
          >
            {piece ? <PieceIcon code={piece} /> : null}
          </Square>
        </div>
      );
    }
  }

  return (
    <div>
      <div style={{
        width: "600px",
        aspectRatio: "1 / 1",
        display: "grid",
        gridTemplateColumns: "repeat(8, 1fr)",
        gridTemplateRows: "repeat(8, 1fr)",
        border: "2px solid #555",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      }}>
        {squares}
      </div>
      {pendingPromotion && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 100,
        }}>
          <div style={{
            background: "#2a2a2a", borderRadius: "12px", padding: "24px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "16px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          }}>
            <h2 style={{ color: "#fff", margin: 0, fontFamily: "sans-serif" }}>Promote Pawn</h2>
            <div style={{ display: "flex", gap: "12px" }}>
              {["Q", "R", "B", "N"].map(choice => (
                <button
                  key={choice}
                  onClick={() => onPromotion(choice)}
                  style={{
                    fontSize: "2.5rem",
                    background: "#3a3a3a",
                    border: "2px solid #666",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    cursor: "pointer",
                    color: "#fff",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#555")}
                  onMouseLeave={e => (e.currentTarget.style.background = "#3a3a3a")}
                >
                  {pendingPromotion.colour === "W"
                    ? { Q: "♕", R: "♖", B: "♗", N: "♘" }[choice]
                    : { Q: "♛", R: "♜", B: "♝", N: "♞" }[choice]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
