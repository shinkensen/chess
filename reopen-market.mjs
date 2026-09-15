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

console.log('🔧 Reopening suspended market...\n');

const { data: market } = await supabase
  .from('markets')
  .select('*')
  .eq('id', 'b674ee0b-bd7c-4855-b947-bbdae816c22c')
  .single();

console.log(`Current status: ${market.status}`);

const { error } = await supabase
  .from('markets')
  .update({ status: 'open' })
  .eq('id', market.id);

if (error) {
  console.error('❌ Error:', error);
} else {
  console.log('✅ Market reopened! Status is now: open');
  console.log('\nYou can now trade on this market!');
}
