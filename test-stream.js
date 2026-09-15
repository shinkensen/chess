// Quick test to verify Lichess stream is working
const gameId = 'AFW6Vh4n';

console.log('Testing Lichess stream for game:', gameId);
console.log('Connecting to https://lichess.org/api/tv/feed...\n');

const controller = new AbortController();
setTimeout(() => controller.abort(), 10000); // Stop after 10 seconds

try {
  const response = await fetch('https://lichess.org/api/tv/feed', {
    signal: controller.signal,
    headers: { Accept: 'application/x-ndjson' }
  });
  
  if (!response.ok) {
    console.error('Stream failed:', response.status);
    process.exit(1);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventCount = 0;
  let foundGame = false;

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
      const id = payload.id || payload.gameId || '';
      
      console.log(`Event ${eventCount}: Game ${id}, Move ${payload.ply || 0}, Status: ${payload.status || 'unknown'}`);
      
      if (id === gameId) {
        foundGame = true;
        console.log('✓ Found target game:', gameId);
        console.log('  White:', payload.players?.white?.user?.name || 'Unknown');
        console.log('  Black:', payload.players?.black?.user?.name || 'Unknown');
        console.log('  FEN:', payload.fen || 'startpos');
      }
    }
  }
  
  console.log(`\nReceived ${eventCount} events`);
  console.log(foundGame ? '✓ Target game is in the stream' : '✗ Target game not found in stream');
  
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('\nTest completed (10 second timeout)');
  } else {
    console.error('Error:', error.message);
    process.exit(1);
  }
}
