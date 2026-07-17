

So here is the roadmap


- Add additonal pieces, arrange the starting configuration of the board
- Highlight possible moves, also running a loop that checks if the king of the player is in direct attacking stance of another piece
through checking the possible moves of every single piece and determining that, and if it is in check and the king has nowhere to 
move through a ray based apporach where you send out 8 rays in all directions and see if theres exactly a single non-defendable
piece and then exactly an attacking piece (like a queen, rook, bishop depending on the direction), essentially I just need to do a 
bunch of checks regarding the kings postion and the pieces arround it.




Make this moreso gambling related where you can create a match 
or spectate a match and bet on it, with the right hand side 
being for time and bet, and the left hand side for seeing other 
games and navigating

The ais can bet against the player by making
bets based on the current status of the game
evaluated by a real chess engine like 
stockfish





Lets breakdown todays tasks

Task 1 - Difficulty level Medium-Hard:
- Save game states to supabase using propper notation
- Enable user accounts and login and auth
- Essentially allow this to be played with multiple users via a 
link with a query parameter that specifies the game
- Essentially create multiplayer and make it work, pretty easy 
with 2 mirrored boards with maybe a move type lock based on the 
white/black specification, just using .subscribe on the supabase 
table/row

Task 2 - Difficulty level Easy-Medium:
- Begin on the betting process with each user being assigned 
like 500 gold on signup, display of that gold in the ui and dash
and being able to bet before every match starts, with the bet 
matching the lower bet amt for each player
- I'm thinking, lets use json to represent each player's 
state in the row, like 2 collumns that represent each player
with each row-column square having this player object 
{
    player: "uuid goes here",
    color: "black or white",
    bet: //init to -1 to represent that they havent placed a bet,
}
with the overall thing looking like this

{
    gameId: "randomly generated id",
    moves: "list of moves",
    mostRecentMove: "yes a bit redundant but keeps code clean",
    turnToPlay: "white or black",
    player1 : playerObject,
    player2 : playerObject,
    pool: 2x the lower of the 2 bets
}

what if instead of a system where players bet inital amts and so do external betters, we had a system were external betters
could "buy in" and sell their stake in the game? Instead of the state of the game based on stockfish analysis or some other engine
the price of each stake could be determined by the number and value of the stakes that others hold instead, 
but how would this work mathematicaly? Maybe the total pool of cost can be reflected by the pool of the players themselves
like a game with a 500 gold pool would stake each share at 5. essentially I am building a prediction market for chess games here



this is the goal today, get the damn game working over multiplayer, we can get the whole homepage, the betting and every other piece of the puzzle sorted later but i want to 
get the core functionality done and dusted rather than working on other stuff first 

