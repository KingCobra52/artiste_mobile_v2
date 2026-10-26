import { Icon } from "./icon";
export function QuoteStatus({
  status,
}: {
  status: "fresh" | "stale" | "unavailable";
}) {
  return (
    <span className={`quote-status status-${status}`}>
      <Icon name={status === "fresh" ? "check" : "clock"} />
      {status === "fresh"
        ? "Fresh quote"
        : status === "stale"
          ? "Stale quote"
          : "Quote unavailable"}
    </span>
  );
}
