import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

import { safeNextPath } from "@/lib/navigation";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  if (!getSupabaseConfig().configured) {
    return NextResponse.redirect(new URL("/login?error=configuration", origin));
  }

  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase!.auth.exchangeCodeForSession(code);
    if (!error) {
      const destination =
        request.nextUrl.searchParams.get("recovery") === "1"
          ? "/reset-password"
          : `/onboarding?next=${encodeURIComponent(safeNextPath(request.nextUrl.searchParams.get("next")))}`;
      return NextResponse.redirect(new URL(destination, origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=callback", origin));
}
