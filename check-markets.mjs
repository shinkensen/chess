import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Parse .env file manually
const envContent = readFileSync('.env', 'utf-8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  line = line.trim();
  if (!line || line.startsWith('#')) return;
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim();
    env[key] = value;
  }
});

console.log('Environment loaded:');
console.log('URL:', env.NEXT_PUBLIC_SUPABASE_URL);
console.log('Key:', env.SUPABASE_SERVICE_ROLE_KEY ? 'Present' : 'Missing');

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('\n🔍 Checking markets...\n');

const { data: markets, error } = await supabase
  .from('markets')
  .select('id, status, white_q, draw_q, black_q, created_at')
  .order('created_at', { ascending: false })
  .limit(5);

if (error) {
  console.error('❌ Error:', error);
} else if (!markets || markets.length === 0) {
  console.log('⚠️  No markets found in database!');
  console.log('\nThis is why trading fails - there are no markets to trade on.');
} else {
  console.log(`✅ Found ${markets.length} markets:\n`);
  markets.forEach((m, i) => {
    console.log(`${i + 1}. Market ${m.id}`);
    console.log(`   Status: ${m.status}`);
    console.log(`   Liquidity: W=${m.white_q} D=${m.draw_q} B=${m.black_q}`);
    console.log(`   Created: ${m.created_at}\n`);
  });
}

// Check games
const { data: games, error: gamesError } = await supabase
  .from('games')
  .select('id, lichess_game_id, status, white_name, black_name')
  .order('created_at', { ascending: false })
  .limit(5);

if (gamesError) {
  console.error('❌ Games Error:', gamesError);
} else if (!games || games.length === 0) {
  console.log('⚠️  No games found in database!');
} else {
  console.log(`\n🎮 Found ${games.length} games:\n`);
  games.forEach((g, i) => {
    console.log(`${i + 1}. ${g.lichess_game_id}`);
    console.log(`   ${g.white_name} vs ${g.black_name}`);
    console.log(`   Status: ${g.status}\n`);
  });
}
