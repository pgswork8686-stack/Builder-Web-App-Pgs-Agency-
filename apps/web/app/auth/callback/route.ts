import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("Error exchanging code for session:", error.message);
      return NextResponse.redirect(
        `${origin}/auth/login?error=auth_callback_failed`,
      );
    }
  }

  // Safe internal redirect URL sanitizer (prevents open redirect vulnerabilities)
  const safeRedirectUrl = getSafeRedirectUrl(next, origin);
  return NextResponse.redirect(safeRedirectUrl);
}

function getSafeRedirectUrl(nextParam: string | null, origin: string): string {
  const defaultTarget = `${origin}/auth/resolve`;
  if (!nextParam) return defaultTarget;

  // Trim whitespace
  const sanitized = nextParam.trim();

  // Must start with '/' but NOT '//', and must NOT contain protocol schemes or colons
  if (
    sanitized.startsWith("/") &&
    !sanitized.startsWith("//") &&
    !sanitized.includes(":") &&
    !sanitized.includes("\\")
  ) {
    return `${origin}${sanitized}`;
  }

  return defaultTarget;
}
