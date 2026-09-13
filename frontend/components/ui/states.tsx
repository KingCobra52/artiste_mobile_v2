import type { ReactNode } from "react";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {[1, 2, 3].map((item) => (
        <div key={item} className="h-24 animate-pulse rounded-2xl bg-slate-800/70" />
      ))}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 px-5 py-9 text-center">
      <h2 className="font-semibold text-white">{title}</h2>
      <div className="mt-2 text-sm leading-6 text-slate-400">{children}</div>
    </div>
  );
}

export function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <div role="alert" className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-5">
      <h2 className="font-semibold text-rose-100">{title}</h2>
      <p className="mt-1 text-sm text-rose-200/80">{message}</p>
    </div>
  );
}

export function StaleDataNotice({ date }: { date: string | null }) {
  return (
    <p className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
      This quote is stale{date ? ` (last updated ${date})` : ""}. Trading is disabled.
    </p>
  );
}
