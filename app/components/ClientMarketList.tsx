'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Market, Prices } from '@/lib/market/types';

const labels: Record<string, string> = { open: 'Live', scheduled: 'Scheduled', suspended: 'Paused', closed: 'Closed', settled: 'Settled', cancelled: 'Cancelled' };

export default function ClientMarketList() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        const response = await fetch('/api/markets', { cache: 'no-store' });
        const data = await response.json();
        if (data.markets) {
          setMarkets(data.markets);
          setLastUpdate(new Date());
        }
      } catch (error) {
        console.error('Failed to fetch markets:', error);
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    void fetchMarkets();

    // Poll every 3 seconds for live updates
    const interval = setInterval(() => {
      void fetchMarkets();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const live = markets.filter((market) => market.status === 'open');
  const scheduled = markets.filter((market) => market.status === 'scheduled');
  const other = markets.filter((market) => market.status !== 'open' && market.status !== 'scheduled');

  if (loading) {
    return (
      <div className="loading-state">
        <span>♟️</span>
        <p>Loading markets...</p>
      </div>
    );
  }

  return (
    <>
      {lastUpdate && (
        <div className="market-update-badge">
          <span className="pulse-dot" />
          Last updated: {lastUpdate.toLocaleTimeString()}
        </div>
      )}
      
      <MarketSection 
        title="Live now" 
        subtitle="Games in progress - trade in real-time" 
        markets={live} 
        empty="No games are live right now." 
      />
      
      <MarketSection 
        title="Starting soon" 
        subtitle="Trade before the first move!" 
        markets={scheduled} 
        empty="No games scheduled." 
      />
      
      <MarketSection 
        title="Completed & other" 
        subtitle="Recently finished and suspended markets" 
        markets={other} 
        empty="No other markets yet." 
      />
    </>
  );
}

function MarketSection({ title, subtitle, markets, empty }: { title: string; subtitle: string; markets: Market[]; empty: string }) {
  if (markets.length === 0) {
    return (
      <section className="market-section market-section-empty">
        <div className="section-heading"><div><h2>{title}</h2><p>{subtitle}</p></div><span>0 markets</span></div>
        <div className="empty-state"><span>♙</span><h3>{empty}</h3><p>Markets appear automatically when the worker ingests featured games.</p></div>
      </section>
    );
  }

  return (
    <section className="market-section">
      <div className="section-heading"><div><h2>{title}</h2><p>{subtitle}</p></div><span>{markets.length} {markets.length === 1 ? 'market' : 'markets'}</span></div>
      <div className="market-grid">{markets.map((market) => <MarketCard key={market.id} market={market} />)}</div>
    </section>
  );
}

function MarketCard({ market }: { market: Market }) {
  const game = market.games;
  const prices = market.prices as Prices;
  return (
    <Link href={`/markets/${market.id}`} className="market-card">
      <div className="card-topline"><span className={`status status-${market.status}`}><i />{labels[market.status]}</span><span>Move {game.move_count}</span></div>
      <div className="matchup">
        <div><span className="piece white-piece">♔</span><div><strong>{game.white_name}</strong><small>{game.white_rating ?? 'Unrated'}</small></div></div>
        <em>vs</em>
        <div><span className="piece black-piece">♚</span><div><strong>{game.black_name}</strong><small>{game.black_rating ?? 'Unrated'}</small></div></div>
      </div>
      <div className="probability-row">
        <Price name="White" value={prices?.white} className="price-white" />
        <Price name="Draw" value={prices?.draw} className="price-draw" />
        <Price name="Black" value={prices?.black} className="price-black" />
      </div>
      <div className="card-footer">
        <span>{formatCredits(market.volume_cents)} volume</span>
        <b>{market.status === 'scheduled' ? 'Trade before start →' : 'View market →'}</b>
      </div>
    </Link>
  );
}

function Price({ name, value, className }: { name: string; value: number | undefined; className: string }) {
  return <div className={className}><span>{name}</span><strong>{Math.round((value ?? 1 / 3) * 100)}¢</strong></div>;
}

function formatCredits(cents: number) {
  return `${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })} cr`;
}
