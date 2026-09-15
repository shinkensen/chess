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

// Sign in as test user
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const { data: authData } = await supabase.auth.signInWithPassword({
  email: 'test@trader.com',
  password: 'test123456'
});

console.log('🧪 Simulating UI trade flow...\n');

// Get market
const { data: market } = await supabase
  .from('markets')
  .select('*')
  .eq('status', 'open')
  .single();

console.log(`Market: ${market.id}`);
console.log(`Liquidity: W=${market.white_q} D=${market.draw_q} B=${market.black_q}\n`);

// Step 1: Get quote (like UI does)
console.log('Step 1: Getting quote...');
const { data: quote1, error: quoteError } = await supabase.rpc('quote_trade', {
  p_market_id: market.id,
  p_outcome: 'white',
  p_side: 'buy',
  p_shares_milli: 10000
});

if (quoteError) {
  console.error('Quote error:', quoteError);
  process.exit(1);
}

console.log(`  Quote: ${quote1.totalCents} cents`);
const limitCents = Math.ceil(quote1.totalCents * 1.02);
console.log(`  2% limit: ${limitCents} cents\n`);

// Step 2: Execute trade (like UI does)
console.log('Step 2: Executing trade with limit...');
const { data: trade, error: tradeError } = await supabase.rpc('execute_trade', {
  p_market_id: market.id,
  p_outcome: 'white',
  p_side: 'buy',
  p_shares_milli: 10000,
  p_limit_cents: limitCents,
  p_idempotency_key: crypto.randomUUID()
});

if (tradeError) {
  console.error('❌ Trade failed:', tradeError.message);
  
  // Get a fresh quote to see what changed
  console.log('\nGetting fresh quote to see difference...');
  const { data: quote2 } = await supabase.rpc('quote_trade', {
    p_market_id: market.id,
    p_outcome: 'white',
    p_side: 'buy',
    p_shares_milli: 10000
  });
  
  console.log(`  Original quote: ${quote1.totalCents} cents`);
  console.log(`  Fresh quote: ${quote2.totalCents} cents`);
  console.log(`  Limit was: ${limitCents} cents`);
  console.log(`  Difference: ${quote2.totalCents - quote1.totalCents} cents`);
  
  if (quote2.totalCents > limitCents) {
    console.log('\n⚠️  Fresh quote exceeds limit! Market moved between quote and execution.');
    console.log('This should NOT happen with no other trades.');
    console.log('\n💡 Possible causes:');
    console.log('  1. Market liquidity changed');
    console.log('  2. Rounding differences between quote calls');
    console.log('  3. Race condition in execute_trade function');
  }
} else {
  console.log(`✅ Trade succeeded: ${trade.tradeId}`);
  console.log(`  Cost: ${trade.totalCents} cents`);
}
