"use client";
import { useRef, useState, useTransition } from "react";
import { useHydrated } from "@/lib/use-hydrated";
import { useRouter } from "next/navigation";
import { previewTrade, submitTrade } from "@/actions/trades";
import { formatMoney } from "@/lib/format";
import type { Artist, MarketQuote, TradeDraft, TradePreview } from "@/types";
export function TradePanel({
  artist,
  currentQuote,
  availablePosition,
  cashCents,
}: {
  artist: Artist;
  currentQuote: MarketQuote;
  availablePosition: number;
  cashCents: number;
}) {
  const hydrated = useHydrated();
  const router = useRouter();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [text, setText] = useState("1");
  const [preview, setPreview] = useState<TradePreview | null>(null);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const request = useRef<string | null>(null);
  const quantity = Number(text);
  const tradable =
    artist.active !== false &&
    currentQuote.status === "fresh" &&
    currentQuote.quoteVersion;
  const quantityError =
    !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1_000_000
      ? "Enter a positive whole number of shares."
      : side === "sell" && quantity > availablePosition
        ? `You have ${availablePosition} shares available.`
        : null;
  function edit() {
    setPreview(null);
    setMessage("");
    request.current = null;
  }
  function draft(): TradeDraft {
    request.current ??= crypto.randomUUID();
    return {
      artistId: artist.id,
      side,
      quantity,
      requestId: request.current,
      quoteVersion: preview?.quoteVersion,
    };
  }
  function review(event: React.FormEvent) {
    event.preventDefault();
    if (quantityError || !tradable || pending) return;
    const order = draft();
    start(async () => {
      const response = await previewTrade(order);
      if ("error" in response) setMessage(response.error);
      else {
        setPreview(response);
        setMessage("");
      }
    });
  }
  function confirm() {
    if (!preview || pending || preview.shadow) return;
    const order = draft();
    start(async () => {
      const result = await submitTrade(order);
      setMessage(result.message);
      if (result.ok) {
        setPreview(null);
        request.current = null;
        router.refresh();
      } else if (
        ["quote_changed", "quote_not_tradable", "artist_unsupported"].includes(
          result.code,
        )
      ) {
        setPreview(null);
        request.current = null;
      }
    });
  }
  return (
    <section
      aria-labelledby="trade-title"
      className="trade-panel rounded-3xl border border-white/10 bg-slate-900 p-5"
    >
      <p className="text-sm text-sky-200">Whole virtual shares</p>
      <h2 id="trade-title" className="mt-1 text-xl font-semibold">
        Trade {artist.symbol}
      </h2>
      <p className="mt-3 text-sm text-slate-300">
        Available cash: {formatMoney(cashCents)} · Owned: {availablePosition}
      </p>
      <form
        onSubmit={review}
        className="mt-5 space-y-4"
        noValidate
        aria-busy={pending}
      >
        <fieldset disabled={pending || !hydrated}>
          <legend className="sr-only">Trade side</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["buy", "sell"] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={`touch rounded-xl capitalize ${side === value ? "action-primary" : "border border-white/20"}`}
                aria-pressed={side === value}
                onClick={() => {
                  setSide(value);
                  edit();
                }}
              >
                {value}
              </button>
            ))}
          </div>
          <label className="mt-5 block">
            Number of shares
            <input
              className="auth-input mt-2"
              inputMode="numeric"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                edit();
              }}
              aria-invalid={Boolean(quantityError)}
              aria-describedby="quantity-error"
            />
          </label>
          <p id="quantity-error" className="mt-2 min-h-5 text-sm text-rose-200">
            {quantityError}
          </p>
        </fieldset>
        {!tradable && (
          <p
            role="status"
            className="rounded-xl bg-amber-300/10 p-3 text-sm text-amber-100"
          >
            A supported artist and a fresh, published quote are required.
            Trading is unavailable.
          </p>
        )}
        {preview && (
          <div className="rounded-xl border border-white/15 p-4">
            <h3 className="font-semibold">Review your paper trade</h3>
            <dl className="mt-3 space-y-2 text-sm">
              {[
                [
                  "Average execution price",
                  formatMoney(preview.executionPriceCents),
                ],
                ["Gross value", formatMoney(preview.grossCents)],
                ["Fee (0.10%)", formatMoney(preview.feeCents)],
                ["Total", formatMoney(preview.totalCents)],
                ["Price impact", `${preview.priceImpactPercent.toFixed(2)}%`],
                ["Price after trade", formatMoney(preview.priceAfterCents)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt>{label}</dt>
                  <dd className="tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-slate-400">
              The estimate uses the entire inventory curve. A changed quote
              requires another review.
            </p>
            {preview.shadow ? (
              <p role="status" className="mt-3 text-sm text-amber-100">
                Preview mode: execution is disabled while the pricing engine is
                validated.
              </p>
            ) : (
              <button
                type="button"
                onClick={confirm}
                disabled={
                  pending || (side === "buy" && preview.totalCents > cashCents)
                }
                className="touch action-primary mt-4 w-full rounded-xl px-4"
              >
                {pending ? "Confirming…" : `Confirm ${side}`}
              </button>
            )}
            {side === "buy" && preview.totalCents > cashCents && (
              <p role="alert" className="mt-3 text-rose-200">
                Not enough virtual cash for this order.
              </p>
            )}
          </div>
        )}
        {message && (
          <p
            role="status"
            className="rounded-xl border border-white/15 p-3 text-sm"
          >
            {message}
          </p>
        )}
        <button
          className="touch w-full rounded-xl border border-sky-200/40 px-4 disabled:opacity-50"
          disabled={!tradable || Boolean(quantityError) || pending || !hydrated}
          type="submit"
        >
          {pending
            ? "Checking…"
            : preview
              ? "Refresh estimate"
              : "Review estimate"}
        </button>
      </form>
    </section>
  );
}
