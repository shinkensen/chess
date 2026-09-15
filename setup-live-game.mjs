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

console.log('🔍 Checking for live game ktINAbyy...\n');

// Check if the game exists in our database
const { data: game } = await supabase
  .from('games')
  .select('*')
  .eq('lichess_game_id', 'ktINAbyy')
  .single();

if (!game) {
  console.log('❌ Game ktINAbyy not found in database');
  console.log('Creating it now with live data from Lichess TV...\n');
  
  // Fetch from Lichess
  const response = await fetch('https://lichess.org/api/tv/feed', {
    headers: { 'Accept': 'application/x-ndjson' }
  });
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let gameId = null;
  let players = null;
  
  // Read first event
  const { value } = await reader.read();
  const text = decoder.decode(value);
  const lines = text.split('\n').filter(l => l.trim());
  
  for (const line of lines) {
    const event = JSON.parse(line);
    if (event.t === 'featured') {
      gameId = event.d.id;
      players = event.d.players;
      
      console.log(`✅ Found LIVE game: ${gameId}`);
      console.log(`   ${players[0].user.name} (${players[0].rating}) vs ${players[1].user.name} (${players[1].rating})`);
      
      // Insert the game
      const { data: newGame, error: gameError } = await supabase
        .from('games')
        .insert({
          lichess_game_id: gameId,
          source: 'featured',
          white_name: players[0].user.name,
          black_name: players[1].user.name,
          white_rating: players[0].rating,
          black_rating: players[1].rating,
          initial_fen: event.d.fen,
          current_fen: event.d.fen,
          status: 'started',
          started_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (gameError) {
        console.error('❌ Error creating game:', gameError);
      } else {
        console.log(`✅ Game created with ID: ${newGame.id}`);
        
        // Create market for this game
        const { data: market, error: marketError } = await supabase
          .from('markets')
          .insert({
            game_id: newGame.id,
            status: 'open',
            white_q: 100000,
            draw_q: 100000,
            black_q: 100000
          })
          .select()
          .single();
        
        if (marketError) {
          console.error('❌ Error creating market:', marketError);
        } else {
          console.log(`✅ Market created with ID: ${market.id}`);
          console.log('   Initial liquidity: W=100000 D=100000 B=100000');
          console.log('\n🎉 Ready to trade!');
        }
      }
      break;
    }
  }
  
  reader.cancel();
} else {
  console.log(`✅ Game ${game.lichess_game_id} exists`);
  console.log(`   ${game.white_name} vs ${game.black_name}`);
  console.log(`   Status: ${game.status}`);
  
  // Check if it has a market
  const { data: market } = await supabase
    .from('markets')
    .select('*')
    .eq('game_id', game.id)
    .single();
  
  if (!market) {
    console.log('\n❌ No market found for this game, creating one...');
    
    const { data: newMarket, error } = await supabase
      .from('markets')
      .insert({
        game_id: game.id,
        status: 'open',
        white_q: 100000,
        draw_q: 100000,
        black_q: 100000
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error:', error);
    } else {
      console.log(`✅ Market created: ${newMarket.id}`);
    }
  } else {
    console.log(`\n✅ Market exists: ${market.id}`);
    console.log(`   Status: ${market.status}`);
    console.log(`   Liquidity: W=${market.white_q} D=${market.draw_q} B=${market.black_q}`);
  }
}
