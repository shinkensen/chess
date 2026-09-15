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

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Testing quote consistency...\n');

// Get market
const { data: market } = await supabase
  .from('markets')
  .select('*')
  .eq('status', 'open')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

console.log(`Market: ${market.id}`);
console.log(`Liquidity: W=${market.white_q} D=${market.draw_q} B=${market.black_q}\n`);

// Get 3 quotes in a row
console.log('Getting 3 quotes for buying 10 white shares...\n');

for (let i = 1; i <= 3; i++) {
  const { data: quote } = await supabase.rpc('quote_trade', {
    p_market_id: market.id,
    p_outcome: 'white',
    p_side: 'buy',
    p_shares_milli: 10000
  });
  
  console.log(`Quote ${i}: ${quote.totalCents} cents (price: ${quote.averagePrice})`);
  console.log(`  White: ${quote.pricesAfter.white}`);
  console.log(`  2% limit: ${Math.ceil(quote.totalCents * 1.02)}\n`);
}

console.log('If quotes are identical, the slippage issue is elsewhere.');
console.log('If quotes vary, there might be concurrent trades happening.');
