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

console.log('🔧 Initializing market with liquidity...\n');

// Get the first scheduled market
const { data: markets } = await supabase
  .from('markets')
  .select('*')
  .eq('status', 'scheduled')
  .order('created_at', { ascending: false })
  .limit(1);

if (!markets || markets.length === 0) {
  console.log('❌ No scheduled markets found');
  process.exit(1);
}

const market = markets[0];
console.log(`Market ID: ${market.id}`);
console.log(`Current liquidity: W=${market.white_q} D=${market.draw_q} B=${market.black_q}\n`);

if (market.white_q === 0 && market.draw_q === 0 && market.black_q === 0) {
  console.log('💉 Injecting initial liquidity (100,000 shares each)...');
  
  const { error } = await supabase
    .from('markets')
    .update({
      white_q: 100000,
      draw_q: 100000,
      black_q: 100000
    })
    .eq('id', market.id);
  
  if (error) {
    console.error('❌ Error:', error);
  } else {
    console.log('✅ Market initialized with liquidity!');
    console.log('   W=100000 D=100000 B=100000');
    console.log('\nYou can now trade on this market!');
  }
} else {
  console.log('✅ Market already has liquidity');
}
