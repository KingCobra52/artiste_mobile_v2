"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeAuthHandoff } from "@/actions/onboarding";
import { clearOnboarding, readOnboarding } from "@/lib/onboarding";

export function AuthContinuation({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  function complete() {
    setError("");
    start(async () => {
      try {
        const result = await completeAuthHandoff(readOnboarding(), nextPath);
        if (result.error) setError(result.error);
        else if (result.destination) {
          if (result.completed) clearOnboarding();
          router.replace(result.destination);
        }
      } catch {
        setError("We could not reach the service. Please try again.");
      }
    });
  }
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    complete();
    // Start once on arrival. The Retry button handles failed requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="mt-6 space-y-4" aria-busy={pending}>
      {error ? (
        <>
          <p role="alert">{error}</p>
          <button
            className="action-primary"
            disabled={pending}
            onClick={complete}
          >
            {pending ? "Saving…" : "Retry"}
          </button>
        </>
      ) : (
        <p role="status">Finishing your account setup…</p>
      )}
    </div>
  );
}
