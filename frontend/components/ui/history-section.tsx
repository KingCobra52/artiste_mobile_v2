import { apiRequest } from "@/lib/api";
import { RetryButton } from "./retry-button";
import { HistoryChart, type HistoryData } from "./history-chart";

export async function HistorySection({
  title,
  path,
}: {
  title: string;
  path: string;
}) {
  let history: HistoryData;
  try {
    history = await apiRequest<HistoryData>(path);
  } catch {
    return (
      <section className="rounded-2xl border border-line p-5">
        <h2 className="font-semibold">{title}</h2>
        <p role="status" className="mt-2 text-sm text-muted">
          History could not be loaded. Use the button below to retry.
        </p>
        <RetryButton />
      </section>
    );
  }
  return <HistoryChart title={title} history={history} />;
}
