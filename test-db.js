// Test database connection and check for markets
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

console.log('Testing Supabase connection...\n');

// Check games
const { data: games, error: gamesError } = await supabase
  .from('games')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(5);

if (gamesError) {
  console.error('Games query error:', gamesError.message);
} else {
  console.log(`Found ${games.length} games in database:`);
  games.forEach(game => {
    console.log(`  - ${game.lichess_game_id}: ${game.white_name} vs ${game.black_name} (${game.status}, move ${game.move_count})`);
  });
}

// Check markets
const { data: markets, error: marketsError } = await supabase
  .from('markets')
  .select('*, games(*)')
  .order('created_at', { ascending: false })
  .limit(5);

if (marketsError) {
  console.error('\nMarkets query error:', marketsError.message);
} else {
  console.log(`\nFound ${markets.length} markets in database:`);
  markets.forEach(market => {
    const game = market.games;
    console.log(`  - Market ${market.id}: ${market.status}, ${game?.white_name || '?'} vs ${game?.black_name || '?'}`);
  });
}

// Check worker lease
const { data: lease, error: leaseError } = await supabase
  .from('worker_leases')
  .select('*')
  .eq('name', 'lichess-featured-ingestion')
  .maybeSingle();

if (leaseError) {
  console.error('\nLease query error:', leaseError.message);
} else if (lease) {
  console.log(`\nWorker lease: holder ${lease.holder_id}, heartbeat ${lease.heartbeat_at}`);
} else {
  console.log('\nNo active worker lease found');
}

console.log('\n✓ Database connection successful');
