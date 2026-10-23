import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "@/components/auth/signup-form";
import { ConfigurationNotice } from "@/components/ui/configuration-notice";
import { getSupabaseConfig } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Create account" };
export const dynamic = "force-dynamic";

export default function SignUpPage() {
  if (!getSupabaseConfig().configured) return <ConfigurationNotice />;

  return (
    <main className="grid min-h-dvh place-items-center px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-white/8 bg-slate-900 p-6 shadow-2xl shadow-black/30 sm:p-8">
        <div className="mb-8 grid size-14 place-items-center rounded-2xl bg-lime-300 text-xl font-black text-slate-950">A</div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lime-200">Paper trading</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Create your account</h1>
        <p className="mt-3 leading-7 text-slate-400">Verify your email to start with $10,000 in virtual cash.</p>
        <SignUpForm />
        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an account? <Link className="font-semibold text-lime-200 hover:text-lime-100" href="/login">Sign in</Link>
        </p>
        <p className="mt-5 text-center text-xs leading-5 text-slate-500">All prices and trades are simulated. Nothing here represents real ownership or moves real money.</p>
      </section>
    </main>
  );
}
