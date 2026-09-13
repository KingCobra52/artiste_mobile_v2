import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { ConfigurationNotice } from "@/components/ui/configuration-notice";
import { getSupabaseConfig } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

function safeNextPath(value: string | string[] | undefined): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/market";
  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
}) {
  if (!getSupabaseConfig().configured) return <ConfigurationNotice />;

  const params = await searchParams;
  return (
    <main className="grid min-h-dvh place-items-center px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-white/8 bg-slate-900 p-6 shadow-2xl shadow-black/30 sm:p-8">
        <div className="mb-8 grid size-14 place-items-center rounded-2xl bg-lime-300 text-xl font-black text-slate-950">A</div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lime-200">Invite-only beta</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Welcome back</h1>
        <p className="mt-3 leading-7 text-slate-400">Sign in with the email and password from your invitation.</p>
        {params.error === "callback" && <p role="alert" className="mt-4 text-sm text-rose-300">We could not finish signing you in. Try again.</p>}
        <LoginForm nextPath={safeNextPath(params.next)} />
      </section>
    </main>
  );
}
