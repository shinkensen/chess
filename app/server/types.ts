// Shared Supabase row/DTO shapes used across the client.

export interface PlayerObj {
  player: string; // auth user id
  color: "white" | "black";
  bet: number;
}

export type GameRowStatus =
  | "open"
  | "active"
  | "white_win"
  | "black_win"
  | "draw";

export interface GameRow {
  gameId: string;
  player1: PlayerObj;
  player2: PlayerObj | null;
  moves: string[] | null;
  mostRecentMove: string | null;
  turnToPlay: "white" | "black";
  pool: number;
  status: GameRowStatus;
  created_at: string;
}

export interface UserRow {
  userId: string;
  email: string | null;
  gold: number;
}

/** engine Colour ("W"|"B") <-> DB ("white"|"black") */
export function colorToDb(c: "W" | "B"): "white" | "black" {
  return c === "W" ? "white" : "black";
}
export function dbToColor(c: string): "W" | "B" {
  return c === "white" ? "W" : "B";
}