export interface LichessTvEvent {
  t: string;
  d: {
    id: string;
    orientation?: string;
    players?: Array<{
      user: { name: string; id: string };
      rating: number;
    }>;
    fen?: string;
    lm?: string; // Last move
  };
}