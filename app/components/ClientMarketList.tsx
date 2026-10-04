'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Market, Prices } from '@/lib/market/types';

const labels: Record<string, string> = { open: 'Live', scheduled: 'Scheduled', suspended: 'Paused', closed: 'Closed', settled: 'Settled', cancelled: 'Cancelled' };

export default function ClientMarketList() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [limit] = useState(50);

  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        const response = await fetch(`/api/markets?limit=${limit}&offset=0`, { cache: 'no-store' });
        const data = await response.json();
        if (data.markets) {
          setMarkets(data.markets);
          setTotal(data.total ?? 0);
        }
      } catch (error) {
        console.error('Failed to fetch markets:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchMarkets();
    const interval = setInterval(() => void fetchMarkets(), 4000);
    return () => clearInterval(interval);
  }, [limit]);

  const loadMore = async () => {
    if (loadingMore || markets.length >= total) return;
    setLoadingMore(true);
    try {
      const response = await fetch(`/api/markets?limit=${limit}&offset=${markets.length}`, { cache: 'no-store' });
      const data = await response.json();
      if (data.markets) setMarkets((prev) => [...prev, ...data.markets]);
    } catch (error) {
      console.error('Failed to load more markets:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const live = markets.filter((market) => market.status === 'open');
  const scheduled = markets.filter((market) => market.status === 'scheduled');
  const other = markets.filter((market) => market.status !== 'open' && market.status !== 'scheduled');

  if (loading) {
    return (
      <div className="market-section">
        <div className="section-heading"><div><h2>Live now</h2><p>Loading markets…</p></div></div>
        <div className="market-grid">{[0, 1].map((key) => <div key={key} className="market-card market-card-skeleton" aria-hidden="true" />)}</div>
      </div>
    );
  }

  return (
    <>
      <MarketSection
        title="Live Games"
        subtitle="Open Markets"
        markets={live}
        empty="No games are live right now."
      />

      <MarketSection
        title="Starting soon"
        subtitle="Upcoming matches"
        markets={scheduled}
        empty="Nothing scheduled at the moment."
      />

      <MarketSection
        title="Settled"
        subtitle="Recently finished markets."
        markets={other}
        empty="No settled markets yet."
      />

      {markets.length < total && (
        <div style={{ textAlign: 'center', margin: '2rem 0' }}>
          <button
            onClick={loadMore}
            disabled={loadingMore}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              background: '#1a1a1a',
              color: '#fff',
              border: '1px solid #333',
              borderRadius: '0.5rem',
              cursor: loadingMore ? 'not-allowed' : 'pointer',
              opacity: loadingMore ? 0.6 : 1,
            }}
          >
            {loadingMore ? 'Loading…' : `Load More (${total - markets.length} remaining)`}
          </button>
        </div>
      )}
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
