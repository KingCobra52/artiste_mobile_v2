import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { safeNextPath } from "@/lib/navigation";
import { copyCookies, refreshSession } from "@/lib/supabase/proxy";

const protectedPrefixes = ["/market", "/artists", "/portfolio", "/account"];

export async function proxy(request: NextRequest) {
  if (!getSupabaseConfig().configured) return NextResponse.next();

  const { authenticated, response } = await refreshSession(request);
  const pathname = request.nextUrl.pathname;
  const isProtected = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !authenticated) {
    const loginUrl = new URL("/login", request.url);
    const destination = request.nextUrl.clone();
    destination.searchParams.delete("_rsc");
    loginUrl.searchParams.set(
      "next",
      safeNextPath(pathname + destination.search),
    );
    return copyCookies(response, NextResponse.redirect(loginUrl));
  }

  if (pathname === "/login" && authenticated) {
    return copyCookies(
      response,
      NextResponse.redirect(
        new URL(
          safeNextPath(request.nextUrl.searchParams.get("next")),
          request.url,
        ),
      ),
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
