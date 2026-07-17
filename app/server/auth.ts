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
