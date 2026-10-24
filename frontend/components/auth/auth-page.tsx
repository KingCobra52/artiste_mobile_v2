import Link from "next/link";
import { ConfigurationNotice } from "@/components/ui/configuration-notice";
import { getSupabaseConfig } from "@/lib/supabase/config";
export function AuthPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  if (!getSupabaseConfig().configured) return <ConfigurationNotice />;
  return (
    <main className="grid min-h-dvh place-items-center px-5 py-8">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 sm:p-8">
        <Link
          className="touch inline-flex items-center text-2xl font-semibold"
          href="/"
        >
          artiste
        </Link>
        <p className="mt-5 text-xs uppercase tracking-widest text-sky-200">
          Music discovery · Paper trading
        </p>
        <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
        <p className="mt-3 leading-7 text-slate-400">{description}</p>
        {children}
        <Link
          href="/onboarding?replay=1"
          className="touch mt-5 flex items-center text-sm text-sky-200"
        >
          How Artiste works
        </Link>
        <p className="mt-3 text-xs leading-5 text-slate-400">
          All cash and shares are virtual. Nothing represents ownership,
          royalties or real money.
        </p>
      </section>
    </main>
  );
}
