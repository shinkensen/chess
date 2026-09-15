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

console.log('🔍 Checking for bot trades...\n');

// Check recent trades
const { data: trades } = await supabase
  .from('trades')
  .select('*, profiles(display_name)')
  .order('created_at', { ascending: false })
  .limit(20);

console.log(`Found ${trades?.length || 0} recent trades:\n`);

const botTrades = trades?.filter(t => t.metadata?.source === 'stockfish-bot' || t.metadata?.source === 'web-bot');
const webTrades = trades?.filter(t => t.metadata?.source === 'web');

console.log(`📊 Trade breakdown:`);
console.log(`   Bot trades: ${botTrades?.length || 0}`);
console.log(`   Web trades: ${webTrades?.length || 0}`);
console.log(`   Other: ${(trades?.length || 0) - (botTrades?.length || 0) - (webTrades?.length || 0)}\n`);

if (botTrades && botTrades.length > 0) {
  console.log('⚠️  BOTS ARE ACTIVELY TRADING!');
  console.log('This explains the slippage - bots trade between quote and execution.\n');
  console.log('Last bot trade:');
  console.log(`   ${botTrades[0].side} ${botTrades[0].shares_milli / 1000} ${botTrades[0].outcome} shares`);
  console.log(`   Cost: ${botTrades[0].total_cents} cents`);
  console.log(`   Time: ${botTrades[0].created_at}`);
  console.log(`   Bot: ${botTrades[0].metadata?.personality || 'unknown'}\n`);
  
  console.log('💡 Solution: Increase slippage tolerance in TradingPanel.tsx');
  console.log('   Change from 1.02 (2%) to 1.05 (5%) or higher');
} else {
  console.log('✅ No bot trades found recently');
  console.log('Slippage issue must be something else');
}
