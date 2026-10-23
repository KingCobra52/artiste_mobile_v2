import { apiRequest } from "@/lib/api";
import { HistoryChart, type HistoryData } from "./history-chart";

export async function HistorySection({ title, path }: { title: string; path: string }) {
  let history: HistoryData;
  try {
    history = await apiRequest<HistoryData>(path);
  } catch {
    return <section className="rounded-2xl border border-white/10 p-5"><h2 className="font-semibold">{title}</h2><p role="status" className="mt-2 text-sm text-slate-400">History could not be loaded. Refresh to try again.</p></section>;
  }
  return <HistoryChart title={title} history={history} />;
}
