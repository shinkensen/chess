"use client";
import { useState, useCallback, useEffect,use } from "react";
import { Board } from "./components/Board";
import { InGame } from "./components/InGame";
import { HomeScreen } from "./components/HomeScreen";
import {
  buildStartingBoard,
  defaultCastlingRights,
  applyMove,
  getGameStatus,
  MovegenOpts,
  Board as ChessBoard,
  CastlingRights,
  Colour,
} from "./components/chess-engine";
import { tryMove, initialGameState, GameState } from "./components/Game";
import { RightDashboard } from "./components/RightDashboard";
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
  const ret = (<div>{gameId ? <InGame gameId={gameId}></InGame> : <HomeScreen></HomeScreen>}</div>);
  return ;
}