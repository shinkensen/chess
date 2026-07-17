CREATE OR REPLACE function submit_move(game_id text, the_move text, next_turn text)
returns void as $$
BEGIN 
    UPDATE games
    SET
        moves = array_append(moves,the_move),
        "mostRecentMove" = the_move,
        "turnToPlay" = next_turn
    where "gameId" = game_id;
end;
$$ language plpgsql;