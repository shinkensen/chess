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

console.log('🔍 Checking database tables...\n');

// Query to list all tables
const { data, error } = await supabase.rpc('exec_sql', {
  sql: `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE '%ledger%'
    ORDER BY table_name;
  `
});

if (error) {
  console.log('Cannot use exec_sql, trying direct query...');
  
  // Try to select from wallet_ledger
  const { data: ledgerData, error: ledgerError } = await supabase
    .from('wallet_ledger')
    .select('*')
    .limit(1);
  
  if (ledgerError) {
    console.error('❌ wallet_ledger error:', ledgerError.message);
  } else {
    console.log('✅ wallet_ledger table exists and is accessible');
    console.log(`   Found ${ledgerData?.length || 0} records`);
  }
} else {
  console.log('Tables with "ledger":', data);
}

// Check the actual function definition in the database
console.log('\n🔍 Checking execute_trade function source...\n');

const { data: funcData, error: funcError } = await supabase
  .from('pg_proc')
  .select('*')
  .eq('proname', 'execute_trade')
  .limit(1);

if (funcError) {
  console.log('Cannot query pg_proc directly');
} else {
  console.log('Function exists:', funcData?.length > 0);
}
