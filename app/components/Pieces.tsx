"use client";
const PIECE_STYLE = { fontSize: "2rem", lineHeight: 1, userSelect: "none" as const };

export function King({ white }: { white: boolean }) {
  return <span style={PIECE_STYLE}>{white ? "♔" : "♚"}</span>;
}
export function Queen({ white }: { white: boolean }) {
  return <span style={PIECE_STYLE}>{white ? "♕" : "♛"}</span>;
}
export function Rook({ white }: { white: boolean }) {
  return <span style={PIECE_STYLE}>{white ? "♖" : "♜"}</span>;
}
export function Bishop({ white }: { white: boolean }) {
  return <span style={PIECE_STYLE}>{white ? "♗" : "♝"}</span>;
}
export function Knight({ white }: { white: boolean }) {
  return <span style={PIECE_STYLE}>{white ? "♘" : "♞"}</span>;
}
export function Pawn({ white }: { white: boolean }) {
  return <span style={PIECE_STYLE}>{white ? "♙" : "♟"}</span>;
}

export function PieceIcon({ code }: { code: string }) {
  if (!code) return null;
  const white = code[1] === "W";
  switch (code[0]) {
    case "K": return <King white={white} />;
    case "Q": return <Queen white={white} />;
    case "R": return <Rook white={white} />;
    case "B": return <Bishop white={white} />;
    case "N": return <Knight white={white} />;
    case "P": return <Pawn white={white} />;
    default: return null;
  }
}