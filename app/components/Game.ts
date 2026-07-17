
import {
  Board,
  Colour,
  CastlingRights,
  MovegenOpts,
  GameStatus,
  legalMoves,
  applyMove,
  getGameStatus,
} from "./chess-engine";
export interface GameState {
  board: Board;
  turn: Colour;
  enPassantTarget: [number, number] | null;
  castlingRights: CastlingRights;
  status: GameStatus;
  pendingPromotion: { r: number; c: number; colour: Colour } | null;
}
export interface MoveResult {
  ok: boolean;
  nextState: GameState;
  captured: boolean;
}
import {gameID} from '../server/backend'
import { submitMove } from "../server/backend";
export function tryMove(
  state: GameState,
  r1: number, c1: number,
  r2: number, c2: number,
  importedMove :boolean = false,
  playerSide?:string
): MoveResult {
  const { board, turn, enPassantTarget, castlingRights } = state;
  const opts: MovegenOpts = { enPassantTarget };
  const piece = board[r1][c1];
  if (playerSide){
    if (!piece || piece[1] !== turn || piece[1] !==playerSide) return { ok: false, nextState: state, captured: false };
  }
  else{
    if (!piece || piece[1] !== turn ) return { ok: false, nextState: state, captured: false };
  }
  const legal = legalMoves(board, r1, c1, opts, castlingRights);
  if (!legal.some(([lr, lc]) => lr === r2 && lc === c2)) {
    return { ok: false, nextState: state, captured: false };
  }
  const captured = board[r2][c2] !== "";
  const {
    board: nextBoard,
    enPassantTarget: nextEP,
    castlingRights: nextCastle,
    needsPromotion,
  } = applyMove(board, r1, c1, r2, c2, opts, castlingRights, "Q");
  const nextTurn: Colour = turn === "W" ? "B" : "W";
  const nextOpts: MovegenOpts = { enPassantTarget: nextEP };
  const nextStatus = getGameStatus(nextBoard, nextTurn, nextOpts, nextCastle);
  const nextState: GameState = {
    board: nextBoard,
    turn: nextTurn,
    enPassantTarget: nextEP,
    castlingRights: nextCastle,
    status: nextStatus,
    pendingPromotion: needsPromotion ? { r: r2, c: c2, colour: turn } : null,
  };
  if (playerSide && playerSide==turn){
    submitMove(r1,r2,c1,c2,gameID,nextTurn)
  }
  return { ok: true, nextState, captured };
}
export function initialGameState(board: Board, castlingRights: CastlingRights): GameState {
  return {
    board,
    turn: "W",
    enPassantTarget: null,
    castlingRights,
    status: "playing",
    pendingPromotion: null,
  };
}
