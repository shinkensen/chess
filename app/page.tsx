import ClientMarketList from './components/ClientMarketList';

export const dynamic = 'force-dynamic';

export default async function Home() {
  return (
    <main className="shell page-shell">
      <section className="hero">
        <div>
          <div className="eyebrow">LIVE CHESS · REAL-TIME PRICES</div>
          <h1>Trade the position.<br /><span>Not the hype.</span></h1>
          <p>Three-outcome prediction markets powered by live featured games and an auditable automated market maker.</p>
        </div>
        <div className="hero-stat-grid" aria-label="Market rules">
          <div><strong>3</strong><span>outcomes</span></div>
          <div><strong>Move 1</strong><span>market opens</span></div>
          <div><strong>100¢</strong><span>winning payout</span></div>
        </div>
      </section>

      <ClientMarketList />

      <section className="how-it-works">
        <div><span>01</span><h3>Watch the board</h3><p>Authoritative positions and clocks come from Lichess.</p></div>
        <div><span>02</span><h3>Choose an outcome</h3><p>Buy or sell White, Draw, or Black shares at an exact LMSR quote.</p></div>
        <div><span>03</span><h3>Settle transparently</h3><p>Winning shares pay one play credit. Credits have no cash value.</p></div>
      </section>
    </main>
  );
}

