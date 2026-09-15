// Fetch current featured games from Lichess TV
console.log('Fetching current featured games from Lichess TV...\n');

const controller = new AbortController();
setTimeout(() => controller.abort(), 5000);

try {
  const response = await fetch('https://lichess.org/api/tv/feed', {
    signal: controller.signal,
    headers: { Accept: 'application/x-ndjson' }
  });
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const games = new Map();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line);
      const payload = event.d || event;
      const id = payload.id || '';
      
      if (id && !games.has(id)) {
        const white = payload.players?.white?.user?.name || 'White';
        const black = payload.players?.black?.user?.name || 'Black';
        const moves = payload.ply || 0;
        const status = payload.status || 'unknown';
        
        games.set(id, { white, black, moves, status });
        console.log(`${id}: ${white} vs ${black} - Move ${moves}, ${status}`);
      }
    }
  }
} catch (error) {
  if (error.name === 'AbortError') {
    const gameIds = Array.from(games.keys());
    console.log(`\n✓ Found ${gameIds.length} current featured games`);
    console.log('\nAdd these to FEATURED_LICHESS_GAME_IDS:');
    console.log(gameIds.join(','));
  } else {
    console.error('Error:', error.message);
  }
}
