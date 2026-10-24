"use client";
import Link from "next/link";
import { useHydrated } from "@/lib/use-hydrated";
import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveOnboarding, type OnboardingState } from "@/actions/onboarding";
const KEY = "artiste:onboarding:v1";
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}
function snapshot() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
const screens = [
  {
    title: "Your ear. Your artist market.",
    text: "Artiste brings music discovery and paper trading together. Research artists, follow their momentum and build a virtual portfolio. Shares give you no ownership or royalties, and cash is not real money.",
    example:
      "Imagine $10,000 of virtual cash and an artist priced at $10 per share. You can buy whole shares—not fractions.",
  },
  {
    title: "Understand what moves a price",
    text: "Audience growth from Last.fm and YouTube sets an anchor. Completed platform buying and selling adjust the quote within limits. New pricing begins in preview mode until its checks pass.",
    example:
      "An artist moving from $10 to $11 changes the value of five shares from $50 to $55. Check the quote date: a stale quote cannot be traded.",
  },
  {
    title: "Research. Review. Track.",
    text: "Read the biography, explore the music and inspect the chart. Choose whole shares, review the estimated price, price impact and fee, then confirm. Your portfolio tracks cash plus holdings over time.",
    example:
      "Five $10 shares cost about $50 plus price impact and fees. The final estimate shows the exact cash needed. If an owned artist becomes unavailable, those shares use purchase cost, clearly marked as a fallback.",
  },
];
export function OnboardingFlow({
  state,
  authenticated,
  replay,
  nextPath,
}: {
  state: OnboardingState | null;
  authenticated: boolean;
  replay: boolean;
  nextPath: string;
}) {
  const hydrated = useHydrated();
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  let local: OnboardingState | null = null;
  try {
    local = raw ? JSON.parse(raw) : null;
  } catch {
    /* Ignore damaged browser storage. */
  }
  const step =
    chosen ??
    (replay
      ? 0
      : state?.completed
        ? 0
        : Math.max(
            0,
            Math.min(2, (state?.version === 1 ? state.step : local?.step) ?? 0),
          ));
  const seen =
    !replay &&
    (state?.completed || ((!state || state.version === 0) && local?.completed));
  function remember(value: OnboardingState) {
    try {
      localStorage.setItem(KEY, JSON.stringify(value));
    } catch {
      /* Account progress still saves through FastAPI. */
    }
  }
  function move(value: number) {
    setChosen(value);
    const next = { version: 1, step: value, completed: false };
    remember(next);
    if (authenticated && !replay)
      start(async () => {
        if (!(await saveOnboarding(next)))
          setError(
            "Progress could not be saved to your account. You can retry or keep reading.",
          );
      });
  }
  function finish() {
    const next = { version: 1, step, completed: true };
    remember(next);
    start(async () => {
      if (authenticated && !(await saveOnboarding(next))) {
        setError(
          "We could not save onboarding. Try again when the service is available.",
        );
        return;
      }
      router.replace(
        authenticated
          ? nextPath
          : `/login?next=${encodeURIComponent(nextPath)}`,
      );
    });
  }
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-8">
      <Link className="touch flex items-center text-2xl font-semibold" href="/">
        artiste
      </Link>
      <section className="my-auto rounded-3xl border border-white/10 bg-slate-900 p-6 sm:p-8">
        <p aria-live="polite" className="text-sm text-sky-200">
          {step + 1} of 3
        </p>
        <h1 className="mt-4 text-4xl leading-tight">{screens[step].title}</h1>
        <p className="mt-5 leading-7 text-slate-300">{screens[step].text}</p>
        <aside className="mt-6 rounded-2xl border border-sky-200/15 bg-sky-200/5 p-4 text-sm leading-7">
          <h2 className="font-semibold">One example, step by step</h2>
          {screens[step].example}
        </aside>
        {seen && (
          <p className="mt-4 text-sm text-slate-400">
            You have seen this introduction. Continue below or replay the
            screens.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm text-rose-200">
            {error}
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <button
            className="touch rounded-xl border border-white/20 px-5 disabled:opacity-40"
            disabled={step === 0 || pending || !hydrated}
            onClick={() => move(step - 1)}
          >
            Back
          </button>
          <button
            className="touch action-primary flex-1 rounded-xl px-5 font-semibold"
            disabled={pending || !hydrated}
            onClick={() => (step === 2 || seen ? finish() : move(step + 1))}
          >
            {pending ? "Saving…" : step === 2 || seen ? "Get started" : "Next"}
          </button>
        </div>
        <button
          className="touch mt-3 w-full text-sm text-slate-300"
          disabled={pending || !hydrated}
          onClick={finish}
        >
          Skip
        </button>
      </section>
    </main>
  );
}
