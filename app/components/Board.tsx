interface BoardProps {
  fen: string;
  lastMove?: string | null;
  orientation?: 'white' | 'black';
}

const pieces: Record<string, string> = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙', k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export default function Board({ fen, lastMove, orientation = 'white' }: BoardProps) {
  const board = parseFen(fen);
  const ranks = orientation === 'white' ? [...Array(8).keys()] : [...Array(8).keys()].reverse();
  const columns = orientation === 'white' ? [...Array(8).keys()] : [...Array(8).keys()].reverse();
  const highlighted = new Set(lastMove?.match(/[a-h][1-8]/g) ?? []);

  return (
    <div className="chessboard" role="grid" aria-label={`Chess position, ${orientation} orientation`}>
      {ranks.flatMap((row) => columns.map((column) => {
        const coordinate = `${files[column]}${8 - row}`;
        const piece = board[row][column];
        const light = (row + column) % 2 === 0;
        return (
          <div key={coordinate} role="gridcell" aria-label={`${coordinate}${piece ? ` ${pieceName(piece)}` : ''}`} className={`board-square ${light ? 'square-light' : 'square-dark'} ${highlighted.has(coordinate) ? 'last-move' : ''}`}>
            {column === columns[0] && <small className="rank-coordinate">{8 - row}</small>}
            {row === ranks[ranks.length - 1] && <small className="file-coordinate">{files[column]}</small>}
            {piece && <span className={piece === piece.toUpperCase() ? 'board-white-piece' : 'board-black-piece'}>{pieces[piece]}</span>}
          </div>
        );
      }))}
    </div>
  );
}

function parseFen(fen: string) {
  const placement = fen === 'startpos' ? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR' : fen.split(' ')[0];
  return placement.split('/').map((rank) => {
    const row: (string | null)[] = [];
    for (const token of rank) {
      if (/\d/.test(token)) row.push(...Array(Number(token)).fill(null));
      else row.push(token);
    }
    return row;
  });
}

function pieceName(piece: string) {
  const color = piece === piece.toUpperCase() ? 'white' : 'black';
  const name: Record<string, string> = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
  return `${color} ${name[piece.toLowerCase()]}`;
}
