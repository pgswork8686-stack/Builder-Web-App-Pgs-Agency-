import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn(
    "Supabase URL or Publishable Key is not configured for Web Server.",
  );
}

// Next.js server-side operations (SSR/Server Actions) only use publishable key + user session
export const supabaseServer = createClient(
  supabaseUrl || "",
  supabasePublishableKey || "",
);
