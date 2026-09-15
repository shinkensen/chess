'use client';

import { useEffect, useMemo, useState } from 'react';
import type { MarketStatus, Outcome, Position, Prices, TradeQuote, TradeSide } from '@/lib/market/types';
import { createBrowserClient } from '@/lib/supabase/client';
import { useAuth } from './AuthProvider';

const outcomes: { key: Outcome; label: string }[] = [{ key: 'white', label: 'White' }, { key: 'draw', label: 'Draw' }, { key: 'black', label: 'Black' }];

export default function TradingPanel({ marketId, status, prices }: { marketId: string; status: MarketStatus; prices: Prices }) {
  const { session } = useAuth();
  const [side, setSide] = useState<TradeSide>('buy');
  const [outcome, setOutcome] = useState<Outcome>('white');
  const [shares, setShares] = useState(10);
  const [quote, setQuote] = useState<TradeQuote | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const tradeable = status === 'open' || status === 'scheduled';

  useEffect(() => {
    if (!session) return;
    const supabase = createBrowserClient();
    const load = async () => {
      const [{ data: positionRows }, { data: wallet }] = await Promise.all([
        supabase.from('positions').select('*').eq('market_id', marketId),
        supabase.from('wallets').select('balance_cents').single(),
      ]);
      setPositions((positionRows ?? []) as Position[]);
      const walletRow = wallet as { balance_cents: number } | null;
      setBalance(walletRow?.balance_cents ?? null);
    };
    void load();
    const channel = supabase.channel(`account:${marketId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'positions', filter: `market_id=eq.${marketId}` }, () => void load()).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'wallets', filter: `profile_id=eq.${session.user.id}` }, () => void load()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [marketId, session]);

  useEffect(() => {
    if (!session || !tradeable || shares <= 0) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const response = await fetch('/api/trade/quote', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ marketId, outcome, side, sharesMilli: shares * 1000 }) });
      const body = await response.json();
      if (response.ok) { setQuote(body.quote ?? body); setMessage(''); } else { setQuote(null); setMessage(body.error ?? 'Unable to quote trade'); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [marketId, tradeable, outcome, session, shares, side]);

  const holding = useMemo(() => positions.find((position) => position.outcome === outcome), [outcome, positions]);
  const priceImpact = quote ? Math.abs(quote.pricesAfter[outcome] - quote.pricesBefore[outcome]) * 100 : 0;

  async function execute() {
    if (!session || !quote) return;
    setPending(true);
    setMessage('');
    
    // Refresh quote right before execution to minimize slippage
    try {
      const refreshResponse = await fetch('/api/trade/quote', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, 
        body: JSON.stringify({ marketId, outcome, side, sharesMilli: shares * 1000 }) 
      });
      const refreshBody = await refreshResponse.json();
      const freshQuote = refreshResponse.ok ? (refreshBody.quote ?? refreshBody) : quote;
      
      const limitCents = side === 'buy' ? Math.ceil(freshQuote.totalCents * 1.05) : Math.floor(freshQuote.totalCents * 0.95);
      
      const response = await fetch('/api/trade/execute', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ marketId, outcome, side, sharesMilli: shares * 1000, limitCents, idempotencyKey: crypto.randomUUID() }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Trade failed');
      setMessage(`Trade filled for ${(Number(body.totalCents ?? body.result?.totalCents) / 100).toFixed(2)} credits.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Trade failed');
    } finally { setPending(false); }
  }

  return (
    <section className="panel trading-panel">
      <div className="panel-heading"><div><span className="eyebrow">ORDER TICKET</span><h2>Trade outcome shares</h2></div>{balance !== null && <div className="wallet-balance"><span>Available</span><strong>{(balance / 100).toLocaleString()} cr</strong></div>}</div>
      {!session && <div className="notice">Sign in from the header to request quotes and trade.</div>}
      {status === 'scheduled' && <div className="notice notice-info">⏳ Game scheduled. You can trade before it starts!</div>}
      {!tradeable && <div className="notice notice-locked">{`This market is ${status}. Trading is unavailable.`}</div>}
      <div className="segmented"><button className={side === 'buy' ? 'active' : ''} onClick={() => setSide('buy')}>Buy</button><button className={side === 'sell' ? 'active' : ''} onClick={() => setSide('sell')}>Sell</button></div>
      <div className="outcome-picker">{outcomes.map((item) => <button key={item.key} className={outcome === item.key ? `active outcome-${item.key}` : ''} onClick={() => setOutcome(item.key)}><span>{item.label}</span><strong>{Math.round(prices[item.key] * 100)}¢</strong></button>)}</div>
      <label className="shares-field"><span>Shares</span><input type="number" min="1" max="1000" step="1" value={shares} onChange={(event) => setShares(Math.max(0, Number(event.target.value)))} /></label>
      <div className="quick-shares">{[5, 10, 25, 50].map((value) => <button key={value} onClick={() => setShares(value)}>{value}</button>)}</div>
      {side === 'sell' && <p className="position-note">You hold {((holding?.shares_milli ?? 0) / 1000).toLocaleString()} {outcome} shares.</p>}
      <div className="quote-card"><div><span>Estimated {side === 'buy' ? 'cost' : 'proceeds'}</span><strong>{quote ? `${(quote.totalCents / 100).toFixed(2)} cr` : '—'}</strong></div><div><span>Average price</span><strong>{quote ? `${(quote.averagePrice * 100).toFixed(1)}¢` : '—'}</strong></div><div><span>Price impact</span><strong>{quote ? `${priceImpact.toFixed(2)} pp` : '—'}</strong></div><div><span>Potential payout</span><strong>{side === 'buy' ? `${shares.toFixed(0)} cr` : '—'}</strong></div></div>
      {message && <div className="notice" role="status">{message}</div>}
      <button className="button button-primary button-block trade-submit" disabled={!session || !tradeable || !quote || pending || (side === 'sell' && (holding?.shares_milli ?? 0) < shares * 1000)} onClick={() => void execute()}>{pending ? 'Submitting…' : `${side === 'buy' ? 'Buy' : 'Sell'} ${shares || 0} ${outcome} shares`}</button>
      <p className="fine-print">Quotes include up to 2% slippage protection. Play credits only; no cash value.</p>
    </section>
  );
}
