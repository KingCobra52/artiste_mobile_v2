"use client";

import { ErrorState } from "@/components/ui/states";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8">
      <ErrorState title="Something went wrong" message="The page could not be loaded. Your account was not changed." />
      <button onClick={reset} className="mt-4 min-h-11 rounded-xl bg-slate-800 px-4 font-semibold text-white hover:bg-slate-700">Try again</button>
    </div>
  );
}
