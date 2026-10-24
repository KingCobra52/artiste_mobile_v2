"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
export function RetryButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="touch mt-4 rounded-xl border border-white/25 px-5 text-sm"
      onClick={() => start(() => router.refresh())}
    >
      {pending ? "Retrying…" : "Try again"}
    </button>
  );
}
