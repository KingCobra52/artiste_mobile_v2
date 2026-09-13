import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/market";
  return value;
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  if (!getSupabaseConfig().configured) {
    return NextResponse.redirect(new URL("/login?error=configuration", origin));
  }

  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase!.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNextPath(request.nextUrl.searchParams.get("next")), origin));
  }

  return NextResponse.redirect(new URL("/login?error=callback", origin));
}
