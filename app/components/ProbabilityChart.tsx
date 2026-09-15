'use client';

import { useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import type { PriceSnapshot, Prices } from '@/lib/market/types';

const series = [
  { key: 'white', label: 'White', color: '#3975f6' },
  { key: 'draw', label: 'Draw', color: '#d78a18' },
  { key: 'black', label: 'Black', color: '#7b5bc7' },
] as const;

export default function ProbabilityChart({ marketId, initialSnapshots, currentPrices }: { marketId: string; initialSnapshots: PriceSnapshot[]; currentPrices: Prices }) {
  const [snapshots, setSnapshots] = useState(initialSnapshots);
  useEffect(() => {
    const supabase = createBrowserClient();
    const channel = supabase.channel(`chart:${marketId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'price_snapshots', filter: `market_id=eq.${marketId}` }, (message) => {
      const row = message.new as Record<string, unknown>;
      setSnapshots((current) => [...current, normalize(row)].slice(-240));
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [marketId]);

  const data = useMemo<PriceSnapshot[]>(() => snapshots.length ? snapshots : [{ id: 0, market_id: marketId, move_count: 0, created_at: new Date().toISOString(), ...currentPrices }], [currentPrices, marketId, snapshots]);
  const points = useMemo(() => series.map((item) => ({ ...item, path: linePath(data.map((point) => point[item.key])) })), [data]);

  return (
    <section className="panel chart-panel">
      <div className="panel-heading"><div><span className="eyebrow">MARKET HISTORY</span><h2>Outcome buy-in price</h2></div><span className="muted">Winning share pays 100¢</span></div>
      <div className="chart-legend">{series.map((item) => <span key={item.key}><i style={{ background: item.color }} />{item.label} <strong>{Math.round(currentPrices[item.key] * 100)}¢</strong></span>)}</div>
      <div className="chart-wrap">
        <svg viewBox="0 0 800 280" role="img" aria-label="White, Draw, and Black outcome prices over time">
          {[0, 25, 50, 75, 100].map((value) => <g key={value}><line x1="44" x2="790" y1={250 - value * 2.2} y2={250 - value * 2.2} className="chart-gridline" /><text x="4" y={255 - value * 2.2}>{value}¢</text></g>)}
          {points.map((item) => <path key={item.key} d={item.path} fill="none" stroke={item.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />)}
        </svg>
      </div>
      <details className="chart-table"><summary>View accessible price table</summary><div className="table-scroll"><table><thead><tr><th>Move</th><th>White</th><th>Draw</th><th>Black</th><th>Time</th></tr></thead><tbody>{data.slice(-20).reverse().map((row) => <tr key={row.id}><td>{row.move_count}</td><td>{percent(row.white)}</td><td>{percent(row.draw)}</td><td>{percent(row.black)}</td><td>{new Date(row.created_at).toLocaleTimeString()}</td></tr>)}</tbody></table></div></details>
    </section>
  );
}

function linePath(values: number[]) {
  if (!values.length) return '';
  return values.map((value, index) => `${index ? 'L' : 'M'} ${44 + (values.length === 1 ? 0 : index * 746 / (values.length - 1))} ${250 - value * 220}`).join(' ');
}

function normalize(row: Record<string, unknown>): PriceSnapshot {
  return { id: Number(row.id), market_id: String(row.market_id), move_count: Number(row.move_count), created_at: String(row.created_at), white: Number(row.white_price), draw: Number(row.draw_price), black: Number(row.black_price) };
}

function percent(value: number) { return `${(value * 100).toFixed(1)}¢`; }
