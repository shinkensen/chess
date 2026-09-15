// Find LIVE games from Lichess TV
console.log('🔍 Scanning Lichess TV for LIVE games...\n');

const controller = new AbortController();
setTimeout(() => controller.abort(), 10000);

const liveGames = new Map();
let eventCount = 0;

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
      
      // Lichess TV sends "featured" events with game metadata
      if (event.t === 'featured' && event.d?.id) {
        const data = event.d;
        const id = data.id;
        const white = data.players?.[0]?.user?.name || 'White';
        const black = data.players?.[1]?.user?.name || 'Black';
        
        if (!liveGames.has(id)) {
          liveGames.set(id, { white, black });
          console.log(`✅ LIVE: ${id}`);
          console.log(`   ${white} vs ${black}`);
          console.log('');
        }
      }
    }
    
    if (liveGames.size >= 5) break;
  }
} catch (error) {
  if (error.name !== 'AbortError') {
    console.error('Error:', error);
  }
}

const gameIds = Array.from(liveGames.keys());
console.log(`\n🎮 Found ${gameIds.length} LIVE games from ${eventCount} events\n`);

if (gameIds.length > 0) {
  console.log('✅ Add these to your .env file:');
  console.log(`NEXT_PUBLIC_FEATURED_GAME_IDS=${gameIds.join(',')}`);
  console.log('\nThese games are LIVE RIGHT NOW!');
} else {
  console.log('⚠️  No "featured" events found.');
  console.log('The stream is working but may need more time.');
}

