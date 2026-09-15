// Monitor the stream for game updates
console.log('Monitoring Lichess stream for game updates...\n');

const gameIds = ['VGbBBoJA', 'eS24tECQ'];
console.log('Watching games:', gameIds.join(', '));

const controller = new AbortController();
setTimeout(() => controller.abort(), 30000);

try {
  const response = await fetch('https://lichess.org/api/tv/feed', {
    signal: controller.signal,
    headers: { Accept: 'application/x-ndjson' }
  });
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let lastSeen = {};

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
      
      if (gameIds.includes(id)) {
        const key = `${id}-${payload.ply || 0}`;
        if (lastSeen[key]) continue;
        lastSeen[key] = true;
        
        const white = payload.players?.white?.user?.name || 'White';
        const black = payload.players?.black?.user?.name || 'Black';
        const moves = payload.ply || 0;
        const status = payload.status || 'unknown';
        
        console.log(`[${new Date().toISOString().split('T')[1].slice(0,8)}] ${id}: ${white} vs ${black}`);
        console.log(`  Move ${moves}, Status: ${status}, FEN: ${payload.fen?.slice(0, 40)}...`);
        
        if (moves > 0) {
          console.log('  ✓ Game has started! Market should be OPEN now.');
        }
      }
    }
  }
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('\nMonitoring complete');
  } else {
    console.error('Error:', error.message);
  }
}
