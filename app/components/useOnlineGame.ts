"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildStartingBoard,
  defaultCastlingRights,
  Colour,
} from "./chess-engine";
import { initialGameState, GameState, tryMove } from "./Game";
import {
  getGame,
  replayMoves,
  resign,
  subscribeToGame,
  submitMove,
} from "../server/backend";
import { getCurrentUser } from "../server/auth";
import { colorToDb, dbToColor } from "../server/types";
import type { GameRow } from "../server/types";
import { getSupabase } from "../utils/supabase";

interface OnlineGame {
  loading: boolean;
  error: string | null;
  row: GameRow | null;
  gameState: GameState;
  /** my colour, or null if I'm not a participant / not loaded */
  myColor: Colour | null;
  /** true when it's my turn */
  myTurn: boolean;
  /** make a move (only if it's my turn); returns true if accepted locally */
  makeMove: (r1: number, c1: number, r2: number, c2: number) => boolean;
  doResign: () => Promise<void>;
  status: "open" | "active" | "white_win" | "black_win" | "draw" | "unknown";
  finished: boolean;
}

/**
 * Drives an online chess game for a given gameId.
 *
 * - Loads the GameRow on mount.
 * - Reconciles local GameState from the server's canonical `moves[]` array
 *   on every realtime update (single source of truth → both clients converge).
 * - Only allows the local player to make moves on their turn; after applying a
 *   move locally it submits it to the server, which broadcasts to the opponent.
 */
export function useOnlineGame(gameId: string): OnlineGame {
  const supabase = getSupabase();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<GameRow | null>(null);
  const [gameState, setGameState] = useState<GameState>(() =>
    initialGameState(buildStartingBoard(), defaultCastlingRights()),
  );
  const [myColor, setMyColor] = useState<Colour | null>(null);
  const userIdRef = useRef<string | null>(null);

  // load current user id once
  useEffect(() => {
    let active = true;
    (async () => {
      if (!supabase) {
        setError("Supabase not configured");
        setLoading(false);
        return;
      }
      const u = await getCurrentUser();
      if (active) userIdRef.current = u?.id ?? null;
    })();
    return () => {
      active = false;
    };
  }, [supabase]);

  // reconcile state from a GameRow
  const reconcile = useCallback((r: GameRow) => {
    setRow(r);
    setGameState(replayMoves(r.moves));
    const uid = userIdRef.current;
    if (uid && r.player1?.player === uid) setMyColor(dbToColor(r.player1.color));
    else if (uid && r.player2?.player === uid) setMyColor(dbToColor(r.player2.color));
    else setMyColor(null);
  }, []);

  // initial fetch + subscribe
  useEffect(() => {
    let unsub: (() => void) | undefined;
    let active = true;
    (async () => {
      if (!supabase) {
        setError("Supabase not configured");
        setLoading(false);
        return;
      }
      const r = await getGame(gameId);
      if (!active) return;
      if (!r) {
        setError("Game not found");
        setLoading(false);
        return;
      }
      reconcile(r);
      setLoading(false);
      unsub = subscribeToGame(gameId, (nr) => reconcile(nr));
    })();
    return () => {
      active = false;
      unsub?.();
    };
  }, [gameId, supabase, reconcile]);

  const myTurn =
    !!row &&
    !!myColor &&
    row.status === "active" &&
    dbToColor(row.turnToPlay) === myColor;

  // if my userId hasn't loaded yet but row is present, derive color once we
  // have it by re-reconciling when the row is already there.
  useEffect(() => {
    if (row && userIdRef.current && myColor === null) reconcile(row);
  }, [row, myColor, reconcile]);

  const makeMove = useCallback(
    (r1: number, c1: number, r2: number, c2: number): boolean => {
      if (!row || !myColor || row.status !== "active") return false;
      if (dbToColor(row.turnToPlay) !== myColor) return false;

      const result = tryMove(gameState, r1, c1, r2, c2, myColor);
      if (!result.ok) return false;

      // apply locally for instant feedback
      setGameState(result.nextState);

      // persist: promotion defaults to queen; turn flips to opponent
      const nextTurn = colorToDb(result.nextState.turn);
      submitMove(gameId, r1, c1, r2, c2, nextTurn).then((ok) => {
        if (!ok) setError("Failed to submit move");
      });

      // if the move ended the game, settle on the client side too
      const st = result.nextState.status;
      if (st === "checkmate") {
        const winner = myColor; // I just checkmated → I won
        const res = winner === "W" ? "white_win" : "black_win";
        import("../server/backend").then(({ finishGame }) =>
          finishGame(gameId, res),
        );
      } else if (st === "stalemate") {
        import("../server/backend").then(({ finishGame }) =>
          finishGame(gameId, "draw"),
        );
      }
      return true;
    },
    [row, myColor, gameState, gameId],
  );

  const doResign = useCallback(async () => {
    if (!myColor) return;
    await resign(gameId, myColor);
  }, [gameId, myColor]);

  const status = row?.status ?? "unknown";
  const finished =
    status === "white_win" || status === "black_win" || status === "draw";

  return {
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
  };
}