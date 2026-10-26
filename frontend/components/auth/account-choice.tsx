"use client";

import { useState, useTransition } from "react";
import { completeAuthHandoff } from "@/actions/onboarding";
import { switchAccount } from "@/actions/auth";
import { clearOnboarding } from "@/lib/onboarding";
import { useHydrated } from "@/lib/use-hydrated";

export function AccountChoice({
  account,
  nextPath,
}: {
  account: string;
  nextPath: string;
}) {
  const hydrated = useHydrated();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  function choose(target: "continue" | "login" | "signup") {
    if (pending) return;
    setError("");
    start(async () => {
      try {
        const result =
          target === "continue"
            ? await completeAuthHandoff(null, nextPath)
            : await switchAccount(target, nextPath);
        if (result.error) setError(result.error);
        else if (result.destination) {
          clearOnboarding();
          window.location.assign(result.destination);
        }
      } catch {
        setError("We could not reach the service. Please try again.");
      }
    });
  }
  return (
    <div className="mt-6 space-y-4" aria-busy={pending}>
      {error && <p role="alert">{error}</p>}
      <fieldset disabled={pending || !hydrated} className="space-y-4">
        <button
          className="action-primary w-full"
          onClick={() => choose("continue")}
        >
          Continue as {account}
        </button>
        <button
          className="action-secondary w-full"
          onClick={() => choose("login")}
        >
          Sign in with another account
        </button>
        <button
          className="action-secondary w-full"
          onClick={() => choose("signup")}
        >
          Create account
        </button>
      </fieldset>
      {pending && <p role="status">Please wait…</p>}
    </div>
  );
}
