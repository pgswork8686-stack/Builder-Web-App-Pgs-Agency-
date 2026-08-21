import { createClient } from "@supabase/supabase-js";

const client = createClient("http://127.0.0.1:54321", "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH");
const { data, error } = await client.from("profiles").select("*").limit(1);
console.log("Publishable key profiles select:", data, error);
