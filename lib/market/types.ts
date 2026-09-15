export type Outcome = 'white' | 'draw' | 'black';
export type TradeSide = 'buy' | 'sell';
export type MarketStatus = 'scheduled' | 'open' | 'suspended' | 'closed' | 'settled' | 'cancelled';

export interface Prices {
  white: number;
  draw: number;
  black: number;
}

export interface Game {
  id: string;
  lichess_game_id: string;
  white_name: string;
  black_name: string;
  white_rating: number | null;
  black_rating: number | null;
  current_fen: string | null;
  last_move: string | null;
  move_count: number;
  white_clock_ms: number | null;
  black_clock_ms: number | null;
  status: string;
  winner: Outcome | null;
  last_event_at: string;
}

export interface Market {
  id: string;
  game_id: string;
  status: MarketStatus;
  volume_cents: number;
  settled_outcome: Outcome | null;
  created_at: string;
  games: Game;
  prices: Prices;
}

export interface Position {
  profile_id: string;
  market_id: string;
  outcome: Outcome;
  shares_milli: number;
  cost_basis_cents: number;
}

export interface PriceSnapshot extends Prices {
  id: number;
  market_id: string;
  move_count: number;
  created_at: string;
}

export interface TradeQuote {
  marketId: string;
  outcome: Outcome;
  side: TradeSide;
  sharesMilli: number;
  totalCents: number;
  averagePrice: number;
  pricesBefore: Prices;
  pricesAfter: Prices;
}
