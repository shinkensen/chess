// Real-time monitoring of Lichess stream and database sync
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const gameIds = ['E5hY08DB', 'cfjkpb0h', 'VGbBBoJA', 'eS24tECQ'];
console.log('🎮 Monitoring Lichess stream and database for game updates\n');
console.log('Watching games:', gameIds.join(', '));
console.log('Press Ctrl+C to stop\n');

const controller = new AbortController();
setTimeout(() => controller.abort(), 60000); // 1 minute

let eventCount = 0;
let lastDbCheck = Date.now();

async function checkDatabase() {
  const { data: games } = await supabase
    .from('games')
    .select('lichess_game_id, white_name, black_name, status, move_count')
    .in('lichess_game_id', gameIds);
  
  const { data: markets } = await supabase
    .from('markets')
    .select('id, status, game_id, games!inner(lichess_game_id)')
    .in('games.lichess_game_id', gameIds);
  
  console.log('\n📊 Database status:');
  games?.forEach(g => {
    const market = markets?.find(m => m.games.lichess_game_id === g.lichess_game_id);
    console.log(`  ${g.lichess_game_id}: ${g.status} (move ${g.move_count}) - Market: ${market?.status || 'none'}`);
  });
}

try {
  const response = await fetch('https://lichess.org/api/tv/feed', {
    signal: controller.signal,
    headers: { Accept: 'application/x-ndjson' }
  });
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    
    for (const line of lines) {
      if (!line.trim()) continue;
      eventCount++;
      
      const event = JSON.parse(line);
      const payload = event.d || event;
      const id = payload.id || '';
      
      if (gameIds.includes(id)) {
        const white = payload.players?.white?.user?.name || 'White';
        const black = payload.players?.black?.user?.name || 'Black';
        const moves = payload.ply || 0;
        const status = payload.status || 'unknown';
        
        console.log(`\n⚡ ${id}: ${white} vs ${black}`);
        console.log(`   Move ${moves}, Status: ${status}`);
        
        if (moves > 0) {
          console.log('   ✅ GAME IS LIVE! Market should be OPEN');
        } else {
          console.log('   ⏳ Waiting for first move...');
        }
      }
    }
    
    // Check DB every 10 seconds
    if (Date.now() - lastDbCheck > 10000) {
      await checkDatabase();
      lastDbCheck = Date.now();
    }
  }
} catch (error) {
  if (error.name === 'AbortError') {
    console.log(`\n\n✓ Monitoring complete. Received ${eventCount} total events`);
    await checkDatabase();
  } else {
    console.error('Error:', error);
  }
}
