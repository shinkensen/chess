import { supabase } from "../utils/supabase";

export async function isLoggedIn(){
    return (await supabase.auth.getUser()).data.user?.id;
}
export async function createAccount(email:string,password:string){
    const {data, error} = await supabase.auth.signUp({email,password});
    if (error){
        return false;
    }
    const uuid= data.user?.id;
    const {data: d,error:e} = await supabase
        .from("users")
        .insert({userId:uuid})
    if (e){
        return false;
    }
}
export async function createGame() {
    const userID = await isLoggedIn()
    if (!userID) return {status:false,error:"user is not logged in"};
    const player = {
        player: userID,
        color: Math.random() <0.5 ? "white" : "black",
        bet: -1
    }   
    const {data,error} = await supabase
        .from("games")
        .insert({player2:player})
        .select("gameId")
        .single();
    if (error){
        console.error(error.message)
        return {error:error.message, status:false};
    }
    else {
        return {
            status:true,
            shareUrl: `/game?gameId=${data.gameId}`,
            gameId:data.gameId
        }
    }
}