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

console.log('🧪 Testing trade execution...\n');

// Get a test user (or create one)
const testEmail = 'test@trader.com';
const testPassword = 'test123456';

// Sign up/sign in
let { data: authData, error: authError } = await supabase.auth.signInWithPassword({
  email: testEmail,
  password: testPassword
});

if (authError) {
  console.log('Creating test user...');
  const { data: signupData, error: signupError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword
  });
  
  if (signupError) {
    console.error('❌ Auth error:', signupError);
    process.exit(1);
  }
  
  authData = signupData;
}

const userId = authData.user.id;
console.log(`✅ Test user: ${userId}\n`);

// Check wallet
const { data: wallet } = await supabase
  .from('wallets')
  .select('*')
  .eq('profile_id', userId)
  .single();

console.log(`💰 Wallet balance: ${wallet?.balance_cents || 0} cents\n`);

// Get the OPEN market
const { data: market } = await supabase
  .from('markets')
  .select('*')
  .eq('status', 'open')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

if (!market) {
  console.log('❌ No open markets found');
  process.exit(1);
}

console.log(`📊 Market: ${market.id}`);
console.log(`   Status: ${market.status}`);
console.log(`   Liquidity: W=${market.white_q} D=${market.draw_q} B=${market.black_q}\n`);

// Get a quote
console.log('📝 Getting quote for buying 10 white shares...');
const { data: quote, error: quoteError } = await supabase.rpc('quote_trade', {
  p_market_id: market.id,
  p_outcome: 'white',
  p_side: 'buy',
  p_shares_milli: 10000
});

if (quoteError) {
  console.error('❌ Quote error:', quoteError);
  process.exit(1);
}

console.log(`✅ Quote: ${quote.totalCents} cents`);
console.log(`   Average price: ${quote.averagePrice}\n`);

// Execute trade
console.log('🔄 Executing trade...');
const { data: trade, error: tradeError } = await supabase.rpc('execute_trade', {
  p_market_id: market.id,
  p_outcome: 'white',
  p_side: 'buy',
  p_shares_milli: 10000,
  p_limit_cents: Math.ceil(quote.totalCents * 1.05),
  p_idempotency_key: crypto.randomUUID()
});

if (tradeError) {
  console.error('❌ Trade error:', tradeError);
  console.error('   Message:', tradeError.message);
  console.error('   Code:', tradeError.code);
  process.exit(1);
}

console.log('✅ Trade executed successfully!');
console.log(`   Trade ID: ${trade.tradeId}`);
console.log(`   Total cost: ${trade.totalCents} cents`);
console.log(`   New balance: ${trade.balanceCents} cents\n`);

console.log('🎉 TRADING IS WORKING! You can now buy shares in the UI.');
