export function formatMoney(cents: number | null): string {
  if (cents === null) return "Unavailable";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function formatDate(value: string | null): string {
  if (!value) return "No quote yet";

  const dateValue = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T00:00:00Z`
    : value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(dateValue));
}

export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "No current quote";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/New_York",
      timeZoneName: "short",
    })
      .formatToParts(new Date(value))
      .map((part) => [part.type, part.value]),
  );
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  // Join parts explicitly: Safari and Node use different date/time separators.
  return `${months[Number(parts.month) - 1]} ${parts.day}, ${parts.year}, ${parts.hour}:${parts.minute} ${parts.dayPeriod} ${parts.timeZoneName}`;
}
