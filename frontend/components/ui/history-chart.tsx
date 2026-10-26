"use client";
import { useId, useState, type PointerEvent } from "react";
import { HoldingPrices } from "@/components/portfolio/holdings-list";
import type { Holding } from "@/types";
import { formatDate, formatMoney, formatTimestamp } from "@/lib/format";
import { Icon } from "./icon";
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
      : 20 + ((Date.parse(p.date) - first) / (last - first)) * 560;
  const y = (p: HistoryPoint) =>
    max === min
      ? 100
      : 180 - (((p.valueCents ?? min) - min) / (max - min)) * 160;
  const portfolio = points.some((p) => p.cashCents !== undefined);
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
    <section aria-labelledby={id} className="panel chart-panel">
      <div className="section-heading">
        <h2 id={id} className="section-title">
          {title}
        </h2>
        <span className="small-copy">
          {portfolio ? "Cash + all holdings" : "Virtual share price"}
        </span>
      </div>
      {!points.length ? (
        <div className="py-8">
          <p className="body-copy">No usable history yet.</p>
          <p className="small-copy mt-2">
            {portfolio
              ? "Your recorded account valuations will appear here. Earlier values are never invented."
              : "The chart will appear when usable price observations are available."}
          </p>
        </div>
      ) : (
        <>
          <div className="chart-readout" data-testid="chart-tooltip">
            <div>
              <p className="small-copy mb-2">
                {portfolio
                  ? "Recorded account value"
                  : "Quote at this observation"}
              </p>
              <p className="chart-readout-value">
                {formatMoney(point.valueCents)}
                {!portfolio && (
                  <span className="text-base text-muted"> / share</span>
                )}
              </p>
            </div>
            <div className="small-copy">
              <p>{formatTimestamp(point.date)}</p>
              <p>
                {point.status === "stale"
                  ? "Uses stale quotes or purchase-cost fallback"
                  : point.status === "unavailable"
                    ? "Quote unavailable"
                    : portfolio
                      ? "Recorded valuation"
                      : "Quoted value"}
              </p>
            </div>
          </div>
          {!portfolio && point.pricingVersion && (
            <p className="small-copy mb-3">
              {point.pricingVersion.startsWith("reconstructed")
                ? "Reconstructed audience price"
                : "Recorded published quote"}
            </p>
          )}
          {point.cashCents !== undefined && (
            <p className="small-copy mb-3">
              Cash {formatMoney(point.cashCents)} · Holdings{" "}
              {formatMoney(point.holdingsCents ?? null)}
            </p>
          )}
          <div
            role="slider"
            tabIndex={0}
            aria-label={`${title} chart`}
            aria-orientation="horizontal"
            aria-valuemin={0}
            aria-valuemax={Math.max(0, points.length - 1)}
            aria-valuenow={index}
            aria-valuetext={`${formatTimestamp(point.date)}: ${formatMoney(point.valueCents)}${portfolio ? " total" : " per share"}. ${point.status}`}
            aria-describedby={`${id}-instructions`}
            className="rounded-lg"
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
            <div className="chart-axis-labels">
              <span>{values.length ? formatMoney(min) : "Unavailable"}</span>
              <span>{values.length ? formatMoney(max) : "Unavailable"}</span>
            </div>
            <svg
              viewBox="0 0 600 200"
              preserveAspectRatio="none"
              className="chart-svg"
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
              {[...new Set(values.length ? [min, max] : [])].map((value) => (
                <line
                  key={value}
                  x1="20"
                  x2="580"
                  y1={y({ ...point, valueCents: value })}
                  y2={y({ ...point, valueCents: value })}
                  className="chart-grid"
                />
              ))}
              <line
                x1={x(point)}
                x2={x(point)}
                y1="10"
                y2="190"
                className="chart-cursor"
              />
              {points.map((p, i) =>
                p.valueCents === null ? null : (
                  <g key={`${p.date}-${i}`}>
                    {i > 0 &&
                      points[i - 1].valueCents !== null &&
                      Date.parse(p.date) - Date.parse(points[i - 1].date) <=
                        86400000 && (
                        <line
                          x1={x(points[i - 1])}
                          x2={x(p)}
                          y1={y(points[i - 1])}
                          y2={y(p)}
                          className="chart-line"
                        />
                      )}
                    <circle
                      cx={x(p)}
                      cy={y(p)}
                      r={i === index ? 5 : 2.5}
                      className={
                        p.status === "stale"
                          ? "chart-point-stale"
                          : "chart-point"
                      }
                    />
                  </g>
                ),
              )}
            </svg>
            <div className="chart-axis-labels">
              <span>{formatDate(points[0].date)}</span>
              <span>{formatDate(points.at(-1)!.date)}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
            <p className="small-copy">
              {portfolio
                ? "Account value (virtual USD)"
                : "Virtual USD / share"}{" "}
              · Date (UTC)
            </p>
            <div className="chart-controls">
              <button
                className="icon-button"
                aria-label="Previous observation"
                disabled={index === 0}
                onClick={() => setSelected(index - 1)}
              >
                <Icon name="back" />
              </button>
              <span className="small-copy">
                {index + 1} of {points.length}
              </span>
              <button
                className="icon-button"
                aria-label="Next observation"
                disabled={index === points.length - 1}
                onClick={() => setSelected(index + 1)}
              >
                <Icon name="arrow" />
              </button>
            </div>
          </div>
          <p id={`${id}-instructions`} className="small-copy mt-3">
            Tap or drag to inspect. With the chart focused, use arrow keys or
            Home / End. Gaps represent missing dates.
          </p>
          {portfolio && (
            <div className="chart-holding-notes">
              <h3 className="text-sm font-semibold">
                Prices used for this account observation
              </h3>
              <p className="small-copy mt-1">
                Account recorded {formatTimestamp(point.date)}
              </p>
              {point.holdings?.length ? (
                <HoldingPrices holdings={point.holdings} />
              ) : (
                <p className="small-copy mt-3">
                  {point.valuationVersion === "purchase-fallback-v2"
                    ? "No holdings at this observation."
                    : "Per-holding quote details were not recorded for this earlier observation."}
                </p>
              )}
            </div>
          )}
          {points.length === 1 && (
            <p className="small-copy mt-4">
              One observation — a trend needs at least two.
            </p>
          )}
        </>
      )}
      <details className="disclosure mt-5">
        <summary>About this chart</summary>
        <p>{history.description}</p>
        {point?.sourceDate && (
          <p>Audience data as of {formatDate(point.sourceDate)}.</p>
        )}
        {!portfolio && point?.pricingVersion && (
          <p>
            {point.pricingVersion.startsWith("reconstructed")
              ? "Reconstructed historical audience price"
              : "Recorded published quote"}{" "}
            · {point.pricingVersion}
          </p>
        )}
        {portfolio && (
          <p>
            Valuation method: {point?.valuationVersion ?? "legacy-v1"}. Values
            include purchase-cost fallbacks when a current quote is unavailable.
          </p>
        )}
      </details>
    </section>
  );
}
