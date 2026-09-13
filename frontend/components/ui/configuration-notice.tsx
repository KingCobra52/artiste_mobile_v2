import { getSupabaseConfig } from "@/lib/supabase/config";

export function ConfigurationNotice() {
  const config = getSupabaseConfig();
  const missing = config.configured ? [] : config.missing;

  return (
    <main className="grid min-h-dvh place-items-center px-5 py-12">
      <section className="w-full max-w-lg rounded-3xl border border-amber-300/25 bg-slate-900 p-6 shadow-2xl shadow-black/30">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-amber-300">
          Setup needed
        </p>
        <h1 className="text-2xl font-semibold text-white">Connect Supabase to continue</h1>
        <p className="mt-3 leading-7 text-slate-300">
          Copy <code className="rounded bg-slate-800 px-1.5 py-1">.env.example</code> to{
          " "}<code className="rounded bg-slate-800 px-1.5 py-1">.env.local</code> and add the
          public project values.
        </p>
        {missing.length > 0 && (
          <div className="mt-5 rounded-2xl bg-slate-950 p-4" aria-label="Missing environment variables">
            <p className="text-sm text-slate-400">Missing:</p>
            <ul className="mt-2 space-y-1 font-mono text-sm text-amber-200">
              {missing.map((name) => <li key={name}>{name}</li>)}
            </ul>
          </div>
        )}
        <p className="mt-5 text-sm leading-6 text-slate-400">
          Only the project URL and publishable key belong in browser configuration. Never add a
          secret or service-role key here.
        </p>
      </section>
    </main>
  );
}
