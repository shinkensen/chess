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

/**
 * Pure move application. No network side effects.
 * `playerSide` optionally restricts which colour is allowed to move here
 * (used by the UI to enforce "only move your own pieces"); when omitted any
 * side whose turn it is may move.
 *
 * "W"/"B" are the engine's internal Colour values. The DB stores "white"/"black",
 * so the caller is responsible for translating.
 */
export function tryMove(
  state: GameState,
  r1: number,
  c1: number,
  r2: number,
  c2: number,
  playerSide?: Colour,
): MoveResult {
  const { board, turn, enPassantTarget, castlingRights } = state;
  const opts: MovegenOpts = { enPassantTarget };
  const piece = board[r1][c1];
  if (!piece || piece[1] !== turn) return { ok: false, nextState: state, captured: false };
  if (playerSide && piece[1] !== playerSide)
    return { ok: false, nextState: state, captured: false };

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
    pendingPromotion: needsPromotion ? { r: r2, c: r2, colour: turn } : null,
  };
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