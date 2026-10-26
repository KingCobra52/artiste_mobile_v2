import { getSupabaseConfig } from "@/lib/supabase/config";

export function ConfigurationNotice() {
  const config = getSupabaseConfig();
  const missing = config.configured ? [] : config.missing;

  return (
    <main className="grid min-h-dvh place-items-center px-5 py-12">
      <section className="panel configuration-notice w-full max-w-lg">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-warning">
          Setup needed
        </p>
        <h1 className="section-title">Connect Supabase to continue</h1>
        <p className="mt-3 leading-7 text-muted">
          Copy{" "}
          <code className="rounded bg-surface-alt px-1.5 py-1">
            .env.example
          </code>{" "}
          to{" "}
          <code className="rounded bg-surface-alt px-1.5 py-1">.env.local</code>{" "}
          and add the public project values.
        </p>
        {missing.length > 0 && (
          <div
            className="mt-5 rounded-2xl bg-surface-alt p-4"
            aria-label="Missing environment variables"
          >
            <p className="text-sm text-muted">Missing:</p>
            <ul className="mt-2 space-y-1 font-mono text-sm text-warning">
              {missing.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-5 text-sm leading-6 text-muted">
          Only the project URL and publishable key belong in browser
          configuration. Never add a secret or service-role key here.
        </p>
      </section>
    </main>
  );
}
