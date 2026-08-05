import { getSupabase } from "../utils/supabase";
import { isLoggedIn } from "./auth";
import type { GameRow, UserRow } from "./types";
import { dbToColor } from "./types";
import { Colour } from "../components/chess-engine";
import {
  buildStartingBoard,
  defaultCastlingRights,
  applyMove,
  getGameStatus,
  MovegenOpts,
} from "../components/chess-engine";
import { initialGameState, GameState } from "../components/Game";

function sb() {
  const s = getSupabase();
  if (!s) throw new Error("Supabase not configured");
  return s;
}

// ---------------------------------------------------------------------------
// Users / gold
// ---------------------------------------------------------------------------

export async function getUserGold(userId: string): Promise<number> {
  const { data } = await sb()
    .from("users")
    .select("gold")
    .eq("userId", userId)
    .single();
  return data?.gold ?? 0;
}

export async function fetchUser(userId: string): Promise<UserRow | null> {
  const { data, error } = await sb()
    .from("users")
    .select("*")
    .eq("userId", userId)
    .single();
  if (error) return null;
  return data as UserRow;
}

// ---------------------------------------------------------------------------
// Lobby: create / list / join games
// ---------------------------------------------------------------------------

export async function createGame(bet: number): Promise<{ ok: boolean; gameId?: string; error?: string }> {
  const userId = await isLoggedIn();
  if (!userId) return { ok: false, error: "Not logged in" };
  if (bet <= 0) return { ok: false, error: "Bet must be positive" };
  if ((await getUserGold(userId)) < bet) return { ok: false, error: "Not enough gold" };

  const { data, error } = await sb().rpc("create_game", { p_bet: bet });
  if (error) return { ok: false, error: error.message };
  return { ok: true, gameId: data as string };
}

export async function listOpenGames(): Promise<GameRow[]> {
  const { data } = await sb()
    .from("games")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false });
  return (data as GameRow[] | null) ?? [];
}

export async function getGame(gameId: string): Promise<GameRow | null> {
  const { data, error } = await sb()
    .from("games")
    .select("*")
    .eq("gameId", gameId)
    .single();
  if (error) return null;
  return data as GameRow;
}

export async function joinGame(
  gameId: string,
  bet: number,
): Promise<{ ok: boolean; error?: string }> {
  const userId = await isLoggedIn();
  if (!userId) return { ok: false, error: "Not logged in" };
  if (bet <= 0) return { ok: false, error: "Bet must be positive" };
  if ((await getUserGold(userId)) < bet) return { ok: false, error: "Not enough gold" };
  const { error } = await sb().rpc("join_game", { p_game_id: gameId, p_bet: bet });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Moves + game state replay
// ---------------------------------------------------------------------------

/** Parse a "r1c1r2c2" move string into component coords. */
export function parseMove(m: string): { r1: number; c1: number; r2: number; c2: number } {
  return {
    r1: parseInt(m.charAt(0), 10),
    c1: parseInt(m.charAt(1), 10),
    r2: parseInt(m.charAt(2), 10),
    c2: parseInt(m.charAt(3), 10),
  };
}

/**
 * Rebuild a full GameState by replaying every move in `moves` from the start.
 * This is the single source of truth for board state; clients reconcile to it
 * on realtime updates so both players always converge regardless of ordering.
 */
export function replayMoves(moves: string[] | null): GameState {
  let state = initialGameState(buildStartingBoard(), defaultCastlingRights());
  if (!moves) return state;
  for (const m of moves) {
    const { r1, c1, r2, c2 } = parseMove(m);
    const opts: MovegenOpts = { enPassantTarget: state.enPassantTarget };
    const result = applyMove(
      state.board,
      r1,
      c1,
      r2,
      c2,
      opts,
      state.castlingRights,
      "Q",
    );
    const turn: Colour = state.turn === "W" ? "B" : "W";
    state = {
      board: result.board,
      turn,
      enPassantTarget: result.enPassantTarget,
      castlingRights: result.castlingRights,
      status: getGameStatus(result.board, turn, { enPassantTarget: result.enPassantTarget }, result.castlingRights),
      pendingPromotion: null,
    };
  }
  return state;
}

export async function submitMove(
  gameId: string,
  r1: number,
  c1: number,
  r2: number,
  c2: number,
  nextTurn: "white" | "black",
): Promise<boolean> {
  const move = `${r1}${c1}${r2}${c2}`;
  const { error } = await sb().rpc("submit_move", {
    p_game_id: gameId,
    p_move: move,
    p_next_turn: nextTurn,
  });
  return !error;
}

export async function finishGame(
  gameId: string,
  result: "white_win" | "black_win" | "draw",
): Promise<boolean> {
  const { error } = await sb().rpc("finish_game", {
    p_game_id: gameId,
    p_result: result,
  });
  return !error;
}

/** Resign: the opposite of your colour wins. */
export async function resign(
  gameId: string,
  yourColor: Colour,
): Promise<boolean> {
  const result = yourColor === "W" ? "black_win" : "white_win";
  return finishGame(gameId, result);
}

// ---------------------------------------------------------------------------
// Realtime subscription
// ---------------------------------------------------------------------------

/**
 * Subscribe to updates on a single game row. Calls `onUpdate` with the latest
 * GameRow whenever anything changes. Returns an unsubscribe function.
 */
export function subscribeToGame(
  gameId: string,
  onUpdate: (row: GameRow) => void,
): () => void {
  const s = sb();
  const channel = s
    .channel(`game-${gameId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "games", filter: `gameId=eq.${gameId}` },
      (payload) => {
        onUpdate(payload.new as GameRow);
      },
    )
    .subscribe();
  return () => {
    s.removeChannel(channel);
  };
}

/** Subscribe to inserts/updates on the games table for lobby refresh. */
export function subscribeToLobby(onChange: () => void): () => void {
  const s = sb();
  const channel = s
    .channel("lobby")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "games" },
      () => onChange(),
    )
    .subscribe();
  return () => {
    s.removeChannel(channel);
  };
}

/** Which colour does `userId` play in `row`, or null if not in the game. */
export function myColor(row: GameRow, userId: string): Colour | null {
  if (row.player1?.player === userId) return dbToColor(row.player1.color);
  if (row.player2?.player === userId) return dbToColor(row.player2.color);
  return null;
}