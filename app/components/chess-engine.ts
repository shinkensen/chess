export type Board = string[][];
export type Colour = "W" | "B";
export function colourOf(piece: string): Colour | null {
  if (!piece) return null;
  return piece[1] === "W" ? "W" : "B";
}
export function typeOf(piece: string): string {
  return piece[0];   // K Q R B N P
}
export function isEnemy(piece: string, colour: Colour): boolean {
  const c = colourOf(piece);
  return c !== null && c !== colour;
}
export function isEmpty(piece: string): boolean {
  return piece === "";
}
export function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}
export function buildStartingBoard(): Board {
  const b: Board = Array.from({ length: 8 }, () => Array(8).fill(""));
  const backRank = ["R", "N", "B", "Q", "K", "B", "N", "R"];
  for (let c = 0; c < 8; c++) {
    b[0][c] = backRank[c] + "B";   
    b[1][c] = "PB";               
    b[6][c] = "PW";                
    b[7][c] = backRank[c] + "W";  
  }
  return b;
}
export interface MovegenOpts {
  enPassantTarget: [number, number] | null; 
}
export function rawMoves(
  board: Board,
  r: number,
  c: number,
  opts: MovegenOpts
): [number, number][] {
  const piece = board[r][c];
  if (!piece) return [];
  const colour = colourOf(piece)!;
  const type = typeOf(piece);
  const moves: [number, number][] = [];
  const slide = (dr: number, dc: number) => {
    let nr = r + dr, nc = c + dc;
    while (inBounds(nr, nc)) {
      if (isEmpty(board[nr][nc])) {
        moves.push([nr, nc]);
      } else {
        if (isEnemy(board[nr][nc], colour)) moves.push([nr, nc]);
        break;
      }
      nr += dr; nc += dc;
    }
  };
  const step = (dr: number, dc: number) => {
    const nr = r + dr, nc = c + dc;
    if (inBounds(nr, nc) && (isEmpty(board[nr][nc]) || isEnemy(board[nr][nc], colour)))
      moves.push([nr, nc]);
  };
  switch (type) {
    case "R":
      slide(1, 0); slide(-1, 0); slide(0, 1); slide(0, -1);
      break;
    case "B":
      slide(1, 1); slide(1, -1); slide(-1, 1); slide(-1, -1);
      break;
    case "Q":
      slide(1, 0); slide(-1, 0); slide(0, 1); slide(0, -1);
      slide(1, 1); slide(1, -1); slide(-1, 1); slide(-1, -1);
      break;
    case "K":
      [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr,dc]) => step(dr,dc));
      break;
    case "N":
      [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc]) => step(dr,dc));
      break;
    case "P": {
      const dir = colour === "W" ? -1 : 1;
      const startRow = colour === "W" ? 6 : 1;
      if (inBounds(r + dir, c) && isEmpty(board[r + dir][c])) {
        moves.push([r + dir, c]);
        if (r === startRow && isEmpty(board[r + 2 * dir][c])) {
          moves.push([r + 2 * dir, c]);
        }
      }
      for (const dc of [-1, 1]) {
        const nr = r + dir, nc = c + dc;
        if (inBounds(nr, nc)) {
          if (isEnemy(board[nr][nc], colour)) moves.push([nr, nc]);
          if (opts.enPassantTarget && opts.enPassantTarget[0] === nr && opts.enPassantTarget[1] === nc)
            moves.push([nr, nc]);
        }
      }
      break;
    }
  }
  return moves;
}
export function isInCheck(board: Board, colour: Colour, opts: MovegenOpts): boolean {
  let kr = -1, kc = -1;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c] === "K" + colour) { kr = r; kc = c; }
  if (kr === -1) return false;   

  const enemy: Colour = colour === "W" ? "B" : "W";
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      if (colourOf(board[r][c]) === enemy) {
        const targets = rawMoves(board, r, c, opts);
        if (targets.some(([tr, tc]) => tr === kr && tc === kc)) return true;
      }
    }
  return false;
}
export function legalMoves(
  board: Board,
  r: number,
  c: number,
  opts: MovegenOpts,
  castlingRights: CastlingRights
): [number, number][] {
  const piece = board[r][c];
  if (!piece) return [];
  const colour = colourOf(piece)!;

  const raw = rawMoves(board, r, c, opts);
  const legal: [number, number][] = [];

  for (const [nr, nc] of raw) {
    // simulate move
    const next = applyMoveRaw(board, r, c, nr, nc, opts);
    if (!isInCheck(next, colour, { enPassantTarget: null })) {
      legal.push([nr, nc]);
    }
  }
  if (typeOf(piece) === "K") {
    const row = colour === "W" ? 7 : 0;
    if (r === row && c === 4) {
      if (castlingRights[colour].kingSide &&
          isEmpty(board[row][5]) && isEmpty(board[row][6]) &&
          !isInCheck(board, colour, opts) &&
          !isInCheck(applyMoveRaw(board, row, 4, row, 5, opts), colour, { enPassantTarget: null }) &&
          !isInCheck(applyMoveRaw(board, row, 4, row, 6, opts), colour, { enPassantTarget: null })) {
        legal.push([row, 6]);
      }
      if (castlingRights[colour].queenSide &&
          isEmpty(board[row][3]) && isEmpty(board[row][2]) && isEmpty(board[row][1]) &&
          !isInCheck(board, colour, opts) &&
          !isInCheck(applyMoveRaw(board, row, 4, row, 3, opts), colour, { enPassantTarget: null }) &&
          !isInCheck(applyMoveRaw(board, row, 4, row, 2, opts), colour, { enPassantTarget: null })) {
        legal.push([row, 2]);
      }
    }
  }

  return legal;
}
export interface CastlingRights {
  W: { kingSide: boolean; queenSide: boolean };
  B: { kingSide: boolean; queenSide: boolean };
}
export function defaultCastlingRights(): CastlingRights {
  return {
    W: { kingSide: true, queenSide: true },
    B: { kingSide: true, queenSide: true },
  };
}

export function applyMoveRaw(
  board: Board,
  r1: number, c1: number,
  r2: number, c2: number,
  opts: MovegenOpts
): Board {
  const next = board.map(row => [...row]);
  const piece = next[r1][c1];
  const colour = colourOf(piece)!;
  const type = typeOf(piece);
  if (type === "P" && c1 !== c2 && isEmpty(board[r2][c2])) {
    const captureRow = colour === "W" ? r2 + 1 : r2 - 1;
    next[captureRow][c2] = "";
  }

  next[r2][c2] = piece;
  next[r1][c1] = "";
  return next;
}
export function applyMove(
  board: Board,
  r1: number, c1: number,
  r2: number, c2: number,
  opts: MovegenOpts,
  castlingRights: CastlingRights,
  promotionChoice: string = "Q"   
): {
  board: Board;
  enPassantTarget: [number, number] | null;
  castlingRights: CastlingRights;
  needsPromotion: boolean;
} {
  const next = board.map(row => [...row]);
  const piece = next[r1][c1];
  const colour = colourOf(piece)!;
  const type = typeOf(piece);
  let enPassantTarget: [number, number] | null = null;
  const newCastling: CastlingRights = {
    W: { ...castlingRights.W },
    B: { ...castlingRights.B },
  };
  let needsPromotion = false;
  if (type === "P" && c1 !== c2 && isEmpty(board[r2][c2])) {
    const captureRow = colour === "W" ? r2 + 1 : r2 - 1;
    next[captureRow][c2] = "";
  }
  if (type === "P" && Math.abs(r2 - r1) === 2) {
    enPassantTarget = [(r1 + r2) / 2, c1];
  }
  if (type === "K") {
    newCastling[colour].kingSide = false;
    newCastling[colour].queenSide = false;
    const row = colour === "W" ? 7 : 0;
    if (c2 === 6 && c1 === 4) {
      next[row][5] = next[row][7];
      next[row][7] = "";
    } else if (c2 === 2 && c1 === 4) {
      next[row][3] = next[row][0];
      next[row][0] = "";
    }
  }
  if (type === "R") {
    if (r1 === 7 && c1 === 7) newCastling.W.kingSide = false;
    if (r1 === 7 && c1 === 0) newCastling.W.queenSide = false;
    if (r1 === 0 && c1 === 7) newCastling.B.kingSide = false;
    if (r1 === 0 && c1 === 0) newCastling.B.queenSide = false;
  }
  if (r2 === 7 && c2 === 7) newCastling.W.kingSide = false;
  if (r2 === 7 && c2 === 0) newCastling.W.queenSide = false;
  if (r2 === 0 && c2 === 7) newCastling.B.kingSide = false;
  if (r2 === 0 && c2 === 0) newCastling.B.queenSide = false;
  next[r2][c2] = piece;
  next[r1][c1] = "";
  if (type === "P" && (r2 === 0 || r2 === 7)) {
    needsPromotion = true;
    next[r2][c2] = promotionChoice + colour;
  }
  return { board: next, enPassantTarget, castlingRights: newCastling, needsPromotion };
}
export type GameStatus = "playing" | "check" | "checkmate" | "stalemate";
export function getGameStatus(
  board: Board,
  colour: Colour,
  opts: MovegenOpts,
  castlingRights: CastlingRights
): GameStatus {
  let anyLegal = false;
  for (let r = 0; r < 8 && !anyLegal; r++)
    for (let c = 0; c < 8 && !anyLegal; c++) {
      if (colourOf(board[r][c]) === colour) {
        if (legalMoves(board, r, c, opts, castlingRights).length > 0) anyLegal = true;
      }
    }

  const inCheck = isInCheck(board, colour, opts);
  if (!anyLegal) return inCheck ? "checkmate" : "stalemate";
  return inCheck ? "check" : "playing";
}