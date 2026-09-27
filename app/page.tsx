import ClientMarketList from './components/ClientMarketList';

export const dynamic = 'force-dynamic';

export default async function Home() {
  return (
    <main className="shell page-shell">
      <section className="hero">
        <div>
          <div className="eyebrow">LIVE FEATURED GAMES</div>
          <h1>Prediction markets on live chess.</h1>
          <p>Buy and sell White, Draw, and Black shares on featured Lichess games at a continuous LMSR quote. Positions settle the moment the game ends.</p>
        </div>
        <dl className="hero-stat-grid" aria-label="How the market works">
          <div><dt>Outcomes</dt><dd>White · Draw · Black</dd></div>
          <div><dt>Market maker</dt><dd>LMSR, on-chain auditable</dd></div>
          <div><dt>Winning share</dt><dd>Pays 100¢ at settlement</dd></div>
        </dl>
      </section>

      <ClientMarketList />

      <section className="how-it-works">
        <div><h3>Positions come from Lichess</h3><p>Board state, clocks, and results are read straight from the featured game feed.</p></div>
        <div><h3>Quotes are exact</h3><p>Every buy and sell is priced by the market maker, not a spread you have to guess at.</p></div>
        <div><h3>Settlement is automatic</h3><p>Winning shares pay one play credit each. Credits carry no cash value.</p></div>
      </section>
    </main>
  );
}
