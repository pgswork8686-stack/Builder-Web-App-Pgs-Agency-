import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn(
    "Supabase client-side credentials are not fully configured in environment variables.",
  );
}

export const supabaseClient = createClient(
  supabaseUrl || "",
  supabasePublishableKey || "",
);
