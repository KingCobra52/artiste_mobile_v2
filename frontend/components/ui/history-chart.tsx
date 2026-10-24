"use client";

import { useId, useState, type PointerEvent } from "react";
import { HoldingPrices } from "@/components/portfolio/holdings-list";
import type { Holding } from "@/types";
import { formatMoney, formatTimestamp } from "@/lib/format";

export interface HistoryPoint {
  date: string;
  holdings?: Holding[];
  valuationVersion?: string;
  pricingVersion?: string;
  valueCents: number | null;
  cashCents?: number;
  holdingsCents?: number | null;
  status: string;
  sourceDate?: string | null;
}
export interface HistoryData {
  points: HistoryPoint[];
  description: string;
}

export function HistoryChart({
  title,
  history,
}: {
  title: string;
  history: HistoryData;
}) {
  const id = useId();
  const [selected, setSelected] = useState<number | null>(null);
  const { points } = history;
  const index = Math.min(selected ?? points.length - 1, points.length - 1);
  const point = points[index];
  const values = points.flatMap((p) =>
    p.valueCents === null ? [] : [p.valueCents],
  );
  const min = Math.min(...values),
    max = Math.max(...values);
  const first = Date.parse(points[0]?.date ?? ""),
    last = Date.parse(points.at(-1)?.date ?? "");
  const x = (p: HistoryPoint) =>
    first === last
      ? 300
      : 64 + ((Date.parse(p.date) - first) / (last - first)) * 520;
  const y = (p: HistoryPoint) =>
    max === min
      ? 90
      : 160 - (((p.valueCents ?? min) - min) / (max - min)) * 140;
  const dateLabel = (value: string) =>
    new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(value));
  const portfolio = points.some((p) => p.cashCents !== undefined);
  const axisLabel = portfolio
    ? "Portfolio value (USD)"
    : "Virtual share price (USD/share)";
  function inspect(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const cursor = ((event.clientX - rect.left) / rect.width) * 600;
    setSelected(
      points.reduce(
        (best, p, i) =>
          Math.abs(x(p) - cursor) < Math.abs(x(points[best]) - cursor)
            ? i
            : best,
        0,
      ),
    );
  }
  return (
    <section
      aria-labelledby={id}
      className="rounded-3xl border border-white/10 bg-slate-900 p-5 sm:p-6"
    >
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        {history.description}
      </p>
      {!points.length ? (
        <p role="status" className="py-8 text-slate-400">
          No usable history yet.
        </p>
      ) : (
        <>
          <p className="mt-5 text-xs font-medium text-slate-300">{axisLabel}</p>
          <div
            className="relative mt-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-200"
            role="slider"
            tabIndex={0}
            aria-label={`${title} chart`}
            aria-orientation="horizontal"
            aria-valuemin={0}
            aria-valuemax={Math.max(0, points.length - 1)}
            aria-valuenow={index}
            aria-valuetext={`${dateLabel(point.date)} UTC: ${formatMoney(point.valueCents)}${portfolio ? " total" : " per share"}. ${point.status}`}
            aria-describedby={`${id}-instructions`}
            onKeyDown={(event) => {
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? points.length - 1
                    : ["ArrowRight", "ArrowUp"].includes(event.key)
                      ? Math.min(index + 1, points.length - 1)
                      : ["ArrowLeft", "ArrowDown"].includes(event.key)
                        ? Math.max(index - 1, 0)
                        : null;
              if (next !== null) {
                event.preventDefault();
                setSelected(next);
              }
            }}
          >
            <div
              className="pointer-events-none mb-3 w-fit max-w-full rounded-xl border border-sky-200/25 bg-slate-950 px-3 py-2 shadow-lg"
              data-testid="chart-tooltip"
              aria-hidden="true"
            >
              <p className="text-xs text-slate-300">
                {dateLabel(point.date)} · UTC
              </p>
              <p className="text-base font-semibold tabular-nums text-white">
                {formatMoney(point.valueCents)}
                {!portfolio && " / share"}
              </p>
              {point.cashCents !== undefined && (
                <p className="text-xs text-slate-300">
                  Cash {formatMoney(point.cashCents)} · Holdings{" "}
                  {formatMoney(point.holdingsCents ?? null)}
                </p>
              )}
              <p className="text-xs text-slate-400">
                {point.status === "stale"
                  ? "Uses stale quotes"
                  : point.status === "unavailable"
                    ? "Quotes unavailable"
                    : "Available at observation"}
                {point.sourceDate
                  ? ` · Source ${dateLabel(point.sourceDate)}`
                  : ""}
              </p>
            </div>
            <div className="mb-2 flex justify-between gap-3 text-xs tabular-nums text-slate-300">
              <span>
                Low {values.length ? formatMoney(min) : "Unavailable"}
              </span>
              <span>
                High {values.length ? formatMoney(max) : "Unavailable"}
              </span>
            </div>
            <svg
              viewBox="0 0 600 200"
              preserveAspectRatio="none"
              className="h-52 w-full touch-pan-y sm:h-64"
              aria-hidden="true"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                inspect(event);
              }}
              onPointerMove={inspect}
              onPointerUp={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId))
                  event.currentTarget.releasePointerCapture(event.pointerId);
              }}
            >
              {[...new Set(values.length ? [min, max] : [])].map((value) => {
                const position = y({ ...point, valueCents: value });
                return (
                  <g key={value}>
                    <line
                      x1="64"
                      x2="584"
                      y1={position}
                      y2={position}
                      stroke="#ffffff15"
                    />
                  </g>
                );
              })}
              <path d="M64 10V170H584" fill="none" stroke="#ffffff35" />
              <line
                x1={x(point)}
                x2={x(point)}
                y1="10"
                y2="170"
                stroke="#b9d9ff80"
                strokeDasharray="3 4"
              />
              {points.map((p, i) =>
                p.valueCents === null ? null : (
                  <g key={p.date}>
                    {i > 0 &&
                      points[i - 1].valueCents !== null &&
                      Date.parse(p.date) - Date.parse(points[i - 1].date) <=
                        86400000 && (
                        <line
                          x1={x(points[i - 1])}
                          y1={y(points[i - 1])}
                          x2={x(p)}
                          y2={y(p)}
                          stroke="#c4ef73"
                          strokeWidth="2"
                        />
                      )}
                    <circle
                      cx={x(p)}
                      cy={y(p)}
                      r={i === index ? 5 : 2.5}
                      fill={p.status === "stale" ? "#fcd34d" : "#c4ef73"}
                      stroke={i === index ? "#fff" : "none"}
                      strokeWidth="1.5"
                    />
                  </g>
                ),
              )}
            </svg>
            <div className="mt-2 flex justify-between gap-3 text-xs text-slate-300">
              <span>{dateLabel(points[0].date)}</span>
              <span>{dateLabel(points.at(-1)!.date)}</span>
            </div>
          </div>
          {portfolio && (
            <div className="mt-4 border-t border-white/10 pt-4">
              <h3 className="text-sm font-semibold">
                Prices used for this account observation
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                Recorded {formatTimestamp(point.date)} ·{" "}
                {point.valuationVersion ?? "legacy-v1"}
              </p>
              {point.holdings?.length ? (
                <HoldingPrices holdings={point.holdings} />
              ) : (
                <p className="mt-2 text-xs text-slate-400">
                  {point.valuationVersion === "purchase-fallback-v2"
                    ? "No holdings at this observation."
                    : "Per-holding quote details were not recorded for this legacy observation."}
                </p>
              )}
            </div>
          )}
          {!portfolio && point.pricingVersion && (
            <p className="mt-3 text-xs text-slate-400">
              {point.pricingVersion.startsWith("reconstructed")
                ? "Reconstructed historical audience price"
                : "Recorded published quote"}{" "}
              · {point.pricingVersion}
            </p>
          )}
          <p className="mt-2 text-center text-xs font-medium text-slate-300">
            Date (UTC)
          </p>
          <p id={`${id}-instructions`} className="mt-3 text-xs text-slate-400">
            Hover, tap or drag to inspect. Focus the chart and use arrow keys;
            Home / End jump to the first / last observation.
          </p>
          {points.length === 1 && (
            <p className="mt-3 text-sm text-slate-400">
              One observation — a trend needs at least two.
            </p>
          )}
          <p className="mt-2 text-xs text-slate-400">
            {dateLabel(points[0].date)} — {dateLabel(points.at(-1)!.date)} ·{" "}
            {points.length} observations. Breaks indicate missing dates.
          </p>
        </>
      )}
    </section>
  );
}
