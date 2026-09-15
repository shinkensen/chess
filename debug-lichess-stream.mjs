// Debug: Show raw Lichess stream data
console.log('🔍 Debugging Lichess TV stream...\n');

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
  let count = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    
    for (const line of lines) {
      if (!line.trim()) continue;
      count++;
      
      console.log(`\n📦 Event ${count}:`);
      console.log('RAW:', line.slice(0, 200) + (line.length > 200 ? '...' : ''));
      
      try {
        const event = JSON.parse(line);
        console.log('Parsed keys:', Object.keys(event));
        
        if (event.t) console.log('  Type:', event.t);
        if (event.d) {
          const data = event.d;
          console.log('  Game ID:', data.id);
          console.log('  Moves (ply):', data.ply);
          console.log('  Status:', data.status);
          console.log('  FEN:', data.fen?.slice(0, 30) + '...');
          if (data.players) {
            console.log('  White:', data.players[0]?.user?.name || data.players.white?.user?.name);
            console.log('  Black:', data.players[1]?.user?.name || data.players.black?.user?.name);
          }
        }
      } catch (e) {
        console.log('Parse error:', e.message);
      }
      
      if (count >= 5) {
        controller.abort();
        break;
      }
    }
  }
} catch (error) {
  if (error.name !== 'AbortError') {
    console.error('Error:', error);
  }
}

console.log(`\n✅ Captured ${count} events`);
