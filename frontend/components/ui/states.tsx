import type { ReactNode } from "react";
import { RetryButton } from "./retry-button";
import { Icon } from "./icon";
export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="grid gap-4">
      <span className="sr-only">{label}</span>
      {[1, 2, 3].map((item) => (
        <div className="skeleton" key={item} aria-hidden="true">
          <div className="skeleton-line" />
          <div className="skeleton-line" />
          <div className="skeleton-line" style={{ width: "80%" }} />
        </div>
      ))}
    </div>
  );
}
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="state-panel">
      <Icon name="record" />
      <h2>{title}</h2>
      <div className="body-copy mt-3">{children}</div>
    </div>
  );
}
export function ErrorState({
  title,
  message,
  retry = true,
}: {
  title: string;
  message: string;
  retry?: boolean;
}) {
  return (
    <div role="alert" className="state-panel state-error">
      <Icon name="help" />
      <h2>{title}</h2>
      <p>{message}</p>
      {retry && <RetryButton />}
    </div>
  );
}
export function StaleDataNotice({
  date,
  status = "stale",
}: {
  date: string | null;
  status?: "stale" | "unavailable";
}) {
  return (
    <p className="notice">
      <Icon name="clock" />
      <span>
        {status === "unavailable"
          ? "No usable quote is available"
          : "This quote is stale"}
        {date ? ` (last updated ${date})` : ""}. Trading is disabled.
      </span>
    </p>
  );
}
