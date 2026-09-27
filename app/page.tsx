import ClientMarketList from './components/ClientMarketList';

export const dynamic = 'force-dynamic';

export default async function Home() {
  return (
    <main className="shell page-shell">
      <section className="hero">
        <div>
          
          <h1>Prediction markets on live chess.</h1>
          <p>Buy and sell White, Draw, and Black shares on live Lichess games.</p>
        </div>
       
      </section>

      <ClientMarketList />

      
    </main>
  );
}
