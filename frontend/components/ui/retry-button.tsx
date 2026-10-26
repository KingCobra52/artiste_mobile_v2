"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Icon } from "./icon";
export function RetryButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="action-secondary mt-4"
      onClick={() => start(() => router.refresh())}
    >
      {pending ? "Retrying…" : "Try again"}
      <Icon name="arrow" />
    </button>
  );
}
