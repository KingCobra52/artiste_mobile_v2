"use client";
import { Wordmark } from "@/components/brand/wordmark";
import { Icon } from "@/components/ui/icon";
import { useHydrated } from "@/lib/use-hydrated";
import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveOnboarding } from "@/actions/onboarding";
import {
  ONBOARDING_KEY,
  clearOnboarding,
  parseOnboarding,
  type OnboardingState,
} from "@/lib/onboarding";

async function persistProgress(value: OnboardingState): Promise<boolean> {
  try {
    return await saveOnboarding(value);
  } catch {
    return false;
  }
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}
function snapshot() {
  try {
    return localStorage.getItem(ONBOARDING_KEY);
  } catch {
    return null;
  }
}
const screens = [
  {
    title: "Your ear. Your artist market.",
    text: "Discover music artists, follow their audience momentum, and practice with virtual shares. All cash is virtual. Shares give you no ownership or royalties.",
    example:
      "Imagine $10,000 of virtual cash and an artist priced at $10 per share. You can buy whole shares—not fractions.",
  },
  {
    title: "Understand what moves a price",
    text: "Audience growth from Last.fm and YouTube helps set a price. Completed platform trades can move it within limits. A quote’s date tells you how current it is; stale quotes cannot be traded.",
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
  needsVerification,
  replay,
  nextPath,
}: {
  state: OnboardingState | null;
  authenticated: boolean;
  needsVerification: boolean;
  replay: boolean;
  nextPath: string;
}) {
  const hydrated = useHydrated();
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState<"move" | "finish">("move");
  const [pending, start] = useTransition();
  const router = useRouter();
  const local = authenticated ? null : parseOnboarding(raw);
  const progress = authenticated ? parseOnboarding(state) : local;
  const step =
    chosen ?? (replay || progress?.completed ? 0 : (progress?.step ?? 0));
  const seen = !replay && progress?.completed;
  function remember(value: OnboardingState) {
    try {
      localStorage.setItem(ONBOARDING_KEY, JSON.stringify(value));
    } catch {
      /* Account progress still saves through FastAPI. */
    }
  }
  function move(value: number) {
    setChosen(value);
    const next = { version: 1, step: value, completed: false };
    setError("");
    if (!authenticated) remember(next);
    if (authenticated && !replay && !state?.completed)
      start(async () => {
        if (!(await persistProgress(next))) {
          setRetry("move");
          setError(
            "Progress could not be saved to your account. You can retry or keep reading.",
          );
        }
      });
  }
  function finish() {
    const next = { version: 1, step, completed: true };
    setError("");
    if (!authenticated) remember(next);
    start(async () => {
      if (authenticated && !(await persistProgress(next))) {
        setRetry("finish");
        setError(
          "We could not save onboarding. Try again when the service is available.",
        );
        return;
      }
      if (authenticated) clearOnboarding();
      router.replace(
        needsVerification
          ? `/login?verify=1&next=${encodeURIComponent(nextPath)}`
          : `/signup?next=${encodeURIComponent(nextPath)}`,
      );
    });
  }
  return (
    <main className="onboarding-shell">
      <header className="onboarding-header">
        <Wordmark href="/" />
        <button
          className="text-link text-sm"
          disabled={pending || !hydrated}
          onClick={finish}
        >
          Skip
        </button>
      </header>
      <section className="onboarding-layout" aria-labelledby="onboarding-title">
        <div className="onboarding-copy">
          <div className="step-progress">
            <div className="step-bars" aria-hidden="true">
              {[0, 1, 2].map((value) => (
                <span key={value} data-complete={value <= step} />
              ))}
            </div>
            <p className="small-copy" aria-live="polite">
              {step + 1} of 3
            </p>
          </div>
          <h1 id="onboarding-title" className="display">
            {screens[step].title}
          </h1>
          <p className="body-copy">{screens[step].text}</p>
          {seen && (
            <p className="small-copy mt-4">
              You’ve seen the introduction. Continue when you’re ready, or
              revisit each step.
            </p>
          )}
          {error && (
            <div className="notice mt-4">
              <p role="alert">{error}</p>
              <button
                className="action-secondary mt-4"
                disabled={pending}
                onClick={() => (retry === "finish" ? finish() : move(step))}
              >
                Retry
              </button>
            </div>
          )}
        </div>
        <aside className="onboarding-example" key={step}>
          <p className="eyebrow">One example, step by step</p>
          {step === 0 && (
            <div className="example-sleeve" aria-hidden="true">
              <div className="record-art" />
            </div>
          )}
          <h2 className="section-title mt-4">
            {step === 0
              ? "A virtual starting point."
              : step === 1
                ? "Same shares. New quote."
                : "Always review the details."}
          </h2>
          <dl className="example-values">
            {(step === 0
              ? [
                  ["Virtual cash", "$10,000"],
                  ["Example share", "$10"],
                ]
              : step === 1
                ? [
                    ["5 shares at $10", "$50"],
                    ["5 shares at $11", "$55"],
                  ]
                : [
                    ["Whole shares", "5"],
                    ["Quoted value", "$50"],
                  ]
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="small-copy">{label}</dt>
                <dd>
                  <strong>{value}</strong>
                </dd>
              </div>
            ))}
          </dl>
          <p className="body-copy text-sm">{screens[step].example}</p>
          <p className="small-copy mt-4">
            Illustrative example, before fees and price impact. Your order
            estimate shows the final details.{" "}
            {step === 2 &&
              "If execution is disabled, you can still research artists and review estimates."}
          </p>
        </aside>
        <div className="onboarding-actions">
          <button
            className="action-secondary"
            disabled={step === 0 || pending || !hydrated}
            onClick={() => move(step - 1)}
          >
            <Icon name="back" />
            Back
          </button>
          <button
            className="action-primary"
            disabled={pending || !hydrated}
            onClick={() => (step === 2 ? finish() : move(step + 1))}
          >
            {pending ? "Saving…" : step === 2 ? "Get started" : "Next"}
            <Icon name="arrow" />
          </button>
        </div>
      </section>
      <footer className="onboarding-footer">
        Music discovery. Virtual shares. A place to learn.
      </footer>
    </main>
  );
}
