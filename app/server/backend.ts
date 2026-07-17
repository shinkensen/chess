import {supabase} from '../utils/supabase'
import { GameState } from '../components/Game';
import { tryMove } from '../components/Game';
import { isLoggedIn } from './auth';
import { Colour } from '../components/chess-engine';
export let gameID:string;
export const subToMoves = (
    gameId:string,
    gameState:GameState,
    setGameState:(gameState:GameState)=>{}) => {
        const channel = supabase
            .channel(`game-${gameId}`)
            .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "games", filter: `gameId=eq.${gameId}` },
            payload => {
                const rawMove = payload.new.mostRecentMove as string; 
                const move = {
                    r1: parseInt(rawMove.charAt(0)),
                    c1: parseInt(rawMove.charAt(1)),
                    r2: parseInt(rawMove.charAt(2)),
                    c2: parseInt(rawMove.charAt(3))
                }
                const result = tryMove(gameState, move.r1, move.c1, move.r2, move.c2);
                if (result.ok) setGameState(result.nextState);
            }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }
export const connectToGame = async(initalBet:number,gameId:string)=>{
    gameID = gameId;
    const userID = await isLoggedIn()
    if (!userID) return {status:false,error:"user is not logged in"};
    const {data,error} = await supabase.from('games').select("*").eq("gameId",gameId).single();
    if (error || !data){
        return false;
    }
    const player1 = data.player1;
    const color = player1.color == 'white' ? 'black' : 'white';
    const pool = player1.bet <= initalBet ? player1.bet *2 : initalBet *2;
    const {data: data1,error: error1} = await supabase.from('users').select("gold").eq("userId",userID).single();
    if (error) return {status:false,error:"Not able to fetch gold"};
    await supabase.from('users').update({"gold":data1?.gold-(pool/2)}).eq("userId",userID);
    await supabase.from('games').update({"player2":{
        player:userID,
        color,
        bet:initalBet
    }, "pool":pool, "turnToPlay": "white"}).eq("gameId", gameId);
    return {status:true, subToMoves}
}
export async function createGame(initalBet:number) {
    const userID = await isLoggedIn()
    if (!userID) return {status:false,error:"user is not logged in"};
    const player = {
        player: userID,
        color: Math.random() <0.5 ? "white" : "black",
        bet: initalBet
    }   
    const {data,error} = await supabase
        .from("games")
        .insert({"player1":player})
        .select("gameId")
        .single();
    if (error){
        console.error(error.message)
        return {error:error.message, status:false};
    }
    gameID = data.gameId;
    return {
        status:true,
        shareUrl: `/game?gameId=${data.gameId}`,
        gameId:data.gameId,
        subToMoves
    }
}
export async function submitMove(r1:number,c1:number,r2:number,c2:number,gameId:string,nextTurn: 'white' | 'black'){
    const move= `${r1}${c1}${r2}${c2}`;
    await supabase.rpc('submit_move', {
        game_id: gameId,
        the_move: move,
        next_turn: nextTurn
    });
    return true;
}
