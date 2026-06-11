"use client";
import { useState, useCallback, useEffect,use } from "react";
import { Board } from "./Board";
import {
  buildStartingBoard,
  defaultCastlingRights,
  applyMove,
  getGameStatus,
  MovegenOpts,
  Board as ChessBoard,
  CastlingRights,
  Colour,
} from "./chess-engine";
import { tryMove, initialGameState, GameState } from "./Game";
import { RightDashboard } from "./RightDashboard";
import { supabase } from "../utils/supabase";
function createInitialState(): GameState {
  return initialGameState(buildStartingBoard(), defaultCastlingRights());
}
interface PrePromotionSnapshot {
  board: ChessBoard;
  r1: number; c1: number;
  r2: number; c2: number;
  enPassantTarget: [number, number] | null;
  castlingRights: CastlingRights;
  prevTurn: Colour;
}
export default function Home({searchParams}:{searchParams: Promise<{ gameId?: string }>}) {
  const {gameId} = use(searchParams);
  if (gameId){
    
  }
  const [gameState, setGameState] = useState<GameState>(createInitialState);
  const [prePromotion, setPrePromotion] = useState<PrePromotionSnapshot | null>(null);
  const handleMove = useCallback((r1: number, c1: number, r2: number, c2: number) => {
    const snap: PrePromotionSnapshot = {
      board: gameState.board,
      r1, c1, r2, c2,
      enPassantTarget: gameState.enPassantTarget,
      castlingRights: gameState.castlingRights,
      prevTurn: gameState.turn,
    };
    const result = tryMove(gameState, r1, c1, r2, c2);
    if (!result.ok) return;

    if (result.nextState.pendingPromotion) {
      setPrePromotion(snap);
    }
    setGameState(result.nextState);
  }, [gameState]);

  const handlePromotion = useCallback((choice: string) => {
    if (!prePromotion) return;
    const { board, r1, c1, r2, c2, enPassantTarget, castlingRights, prevTurn } = prePromotion;
    const opts: MovegenOpts = { enPassantTarget };
    const { board: nextBoard, enPassantTarget: nextEP, castlingRights: nextCastle } =
      applyMove(board, r1, c1, r2, c2, opts, castlingRights, choice);
    const nextTurn: Colour = prevTurn === "W" ? "B" : "W";
    const nextOpts: MovegenOpts = { enPassantTarget: nextEP };
    const nextStatus = getGameStatus(nextBoard, nextTurn, nextOpts, nextCastle);
    setGameState({
      board: nextBoard,
      turn: nextTurn,
      enPassantTarget: nextEP,
      castlingRights: nextCastle,
      status: nextStatus,
      pendingPromotion: null,
    });
    setPrePromotion(null);
  }, [prePromotion]);
  const resetGame = () => {
    setGameState(createInitialState());
    setPrePromotion(null);
  };
  const { turn, status } = gameState;
  const statusText =
    status === "checkmate"
      ? `Checkmate — ${turn === "W" ? "Black" : "White"} wins!`
      : status === "stalemate"
      ? "Stalemate — Draw!"
      : status === "check"
      ? `${turn === "W" ? "White" : "Black"} is in check!`
      : `${turn === "W" ? "White" : "Black"}'s turn`;

  const statusColor =
    status === "checkmate" ? "#e84040"
    : status === "stalemate" ? "#aaa"
    : status === "check" ? "#f6a623"
    : "#ddd";

  return (
    <main style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: "24px",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>

      <Board
        gameState={gameState}
        onMove={handleMove}
        onPromotion={handlePromotion}
      />
      <RightDashboard></RightDashboard>
    </main>
  );
}