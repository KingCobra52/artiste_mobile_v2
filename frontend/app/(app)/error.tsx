"use client";

import { ErrorState } from "@/components/ui/states";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8">
      <ErrorState
        title="Something went wrong"
        message="The page could not be loaded. Please retry to see its current state."
        retry={false}
      />
      <button onClick={reset} className="action-secondary mt-4">
        Try again
      </button>
    </div>
  );
}
