"use client";

import { useMemo, useState, useTransition } from "react";
import { submitTrade } from "@/actions/trades";
import { formatMoney } from "@/lib/format";
import type { Artist, MarketQuote, TradeDraft, TradeResult } from "@/types";

export function TradePanel({
  artist,
  currentQuote,
  availablePosition,
}: {
  artist: Artist;
  currentQuote: MarketQuote;
  availablePosition: number;
}) {
  const [side, setSide] = useState<TradeDraft["side"]>("buy");
  const [quantityText, setQuantityText] = useState("1");
  const [result, setResult] = useState<TradeResult | null>(null);
  const [pending, startTransition] = useTransition();
  const quantity = Number(quantityText);
  const tradable = currentQuote.status === "fresh" && currentQuote.priceCents !== null;
  const quantityError = !Number.isSafeInteger(quantity) || quantity <= 0
    ? "Enter a positive whole number of shares."
    : side === "sell" && quantity > availablePosition
      ? `You have ${availablePosition} shares available.`
      : null;
  const estimate = useMemo(
    () => currentQuote.priceCents !== null && Number.isSafeInteger(quantity) && quantity > 0
      ? currentQuote.priceCents * quantity
      : null,
    [currentQuote.priceCents, quantity],
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    if (!tradable || quantityError) return;

    const draft: TradeDraft = {
      artistId: artist.id,
      side,
      quantity,
      requestId: crypto.randomUUID(),
    };

    startTransition(async () => setResult(await submitTrade(draft)));
  }

  return (
    <section aria-labelledby="trade-title" className="rounded-3xl border border-white/8 bg-slate-900 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-lime-200">Whole shares</p>
          <h2 id="trade-title" className="mt-1 text-xl font-semibold text-white">Trade {artist.symbol}</h2>
        </div>
        <p className="text-sm text-slate-400">Owned: <span className="font-semibold text-white">{availablePosition}</span></p>
      </div>

      <form className="mt-5 space-y-5" onSubmit={handleSubmit} noValidate>
        <fieldset>
          <legend className="sr-only">Trade side</legend>
          <div className="grid grid-cols-2 rounded-xl bg-slate-950 p-1">
            {(["buy", "sell"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={side === value}
                onClick={() => { setSide(value); setResult(null); }}
                className={`min-h-11 rounded-lg text-sm font-semibold capitalize ${side === value ? "bg-lime-300 text-slate-950" : "text-slate-400 hover:text-white"}`}
              >
                {value}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-200">Number of shares</span>
          <input
            aria-describedby="quantity-error"
            aria-invalid={Boolean(quantityError)}
            className="min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 text-base text-white outline-none focus:border-lime-300 focus:ring-2 focus:ring-lime-300/20"
            inputMode="numeric"
            value={quantityText}
            onChange={(event) => { setQuantityText(event.target.value); setResult(null); }}
          />
          <p id="quantity-error" className="mt-2 min-h-5 text-sm text-rose-300">{quantityError}</p>
        </label>

        <div className="flex items-center justify-between border-y border-white/8 py-4">
          <span className="text-sm text-slate-400">Estimated total</span>
          <strong className="text-lg text-white">{formatMoney(estimate)}</strong>
        </div>

        {!tradable && (
          <p role="status" className="rounded-xl bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
            This quote is not current, so trading is disabled.
          </p>
        )}
        {result && <p role="status" className="rounded-xl bg-sky-300/10 px-3 py-2 text-sm text-sky-100">{result.message}</p>}
        <button
          type="submit"
          disabled={!tradable || Boolean(quantityError) || pending}
          className="min-h-12 w-full rounded-xl bg-lime-300 px-5 font-semibold text-slate-950 hover:bg-lime-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          {pending ? "Checking trade…" : `${side === "buy" ? "Buy" : "Sell"} ${artist.symbol}`}
        </button>
      </form>
    </section>
  );
}
