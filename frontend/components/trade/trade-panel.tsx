"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
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
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const [feedback, setFeedback] = useState<"success" | "error" | null>(null);
  useEffect(() => {
    if (preview) previewHeading.current?.focus();
  }, [preview]);
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
    setFeedback(null);
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
      try {
        const response = await previewTrade(order);
        if ("error" in response) {
          setMessage(response.error);
          setFeedback("error");
        } else {
          setPreview(response);
          setMessage("");
          setFeedback(null);
        }
      } catch {
        setMessage(
          "The estimate could not be loaded. Try again when your connection is ready.",
        );
        setFeedback("error");
      }
    });
  }
  function confirm() {
    if (!preview || pending || preview.shadow) return;
    const order = draft();
    start(async () => {
      try {
        const result = await submitTrade(order);
        setMessage(result.message);
        setFeedback(result.ok ? "success" : "error");
        if (result.ok) {
          setPreview(null);
          request.current = null;
          router.refresh();
        } else if (
          [
            "quote_changed",
            "quote_not_tradable",
            "artist_unsupported",
          ].includes(result.code)
        ) {
          setPreview(null);
          request.current = null;
        }
      } catch {
        setMessage(
          "Confirmation was interrupted. Try confirming again with this estimate; your request will not be duplicated.",
        );
        setFeedback("error");
      }
    });
  }
  return (
    <section className="panel trade-panel" aria-labelledby="trade-title">
      <p className="eyebrow">Paper trading</p>
      <h2 id="trade-title" className="section-title mt-2">
        Trade {artist.symbol}
      </h2>
      <p className="small-copy mt-2">
        Whole virtual shares. Your cash stays virtual.
      </p>
      <dl className="trade-wallet">
        <div>
          <dt className="small-copy">Available cash</dt>
          <dd>{formatMoney(cashCents)}</dd>
        </div>
        <div>
          <dt className="small-copy">Shares owned</dt>
          <dd>{availablePosition}</dd>
        </div>
      </dl>
      <form
        onSubmit={review}
        noValidate
        aria-busy={pending}
        className="space-y-4"
      >
        <fieldset disabled={pending || !hydrated}>
          <legend className="sr-only">Trade side</legend>
          <div className="trade-sides">
            {(["buy", "sell"] as const).map((value) => (
              <button
                type="button"
                key={value}
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
          <label htmlFor="trade-quantity" className="trade-quantity">
            Number of shares
          </label>
          <input
            id="trade-quantity"
            className="auth-input mt-2"
            inputMode="numeric"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              edit();
            }}
            aria-invalid={Boolean(quantityError)}
            aria-describedby="quantity-error"
          />
          <p id="quantity-error" className="mt-2 min-h-5 text-sm text-danger">
            {quantityError}
          </p>
        </fieldset>
        {!tradable && (
          <p role="status" className="notice">
            <Icon name="clock" />
            <span>
              Trading requires an active artist and a fresh, published quote.
            </span>
          </p>
        )}
        {preview && (
          <div className="order-receipt">
            <h3 ref={previewHeading} tabIndex={-1} className="font-semibold">
              Review your paper trade
            </h3>
            <p className="small-copy mt-2">
              {side === "buy" ? "Buy" : "Sell"} {quantity}{" "}
              {quantity === 1 ? "share" : "shares"} · {artist.name}
            </p>
            <dl className="receipt-lines">
              {[
                [
                  "Average execution price",
                  formatMoney(preview.executionPriceCents),
                ],
                ["Gross value", formatMoney(preview.grossCents)],
                ["Fee (0.10%)", formatMoney(preview.feeCents)],
                ["Price impact", `${preview.priceImpactPercent.toFixed(2)}%`],
                ["Price after trade", formatMoney(preview.priceAfterCents)],
                [
                  side === "buy" ? "Total cost" : "Total received",
                  formatMoney(preview.totalCents),
                ],
              ].map(([label, value], index) => (
                <div key={label} className={index === 5 ? "receipt-total" : ""}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p className="small-copy">
              Your estimate includes price impact and fees. If the quote
              changes, you’ll need to review it again.
            </p>
            {preview.shadow ? (
              <p role="status" className="notice mt-4">
                <Icon name="help" />
                <span>Preview only. Paper trading is currently disabled.</span>
              </p>
            ) : (
              <button
                type="button"
                className="action-primary mt-4 w-full"
                onClick={confirm}
                disabled={
                  pending || (side === "buy" && preview.totalCents > cashCents)
                }
              >
                {pending ? "Confirming…" : `Confirm ${side}`}
                <Icon name="check" />
              </button>
            )}
            {side === "buy" && preview.totalCents > cashCents && (
              <p role="alert" className="mt-3 text-sm text-danger">
                Not enough virtual cash for this order.
              </p>
            )}
          </div>
        )}
        {message && (
          <div
            role="status"
            aria-live="polite"
            className="trade-feedback"
            data-result={feedback}
          >
            <p className="flex items-start gap-2">
              <Icon name={feedback === "success" ? "check" : "help"} />
              <span>{message}</span>
            </p>
          </div>
        )}
        <button
          className="action-secondary w-full"
          disabled={!tradable || Boolean(quantityError) || pending || !hydrated}
          type="submit"
        >
          {pending
            ? "Checking…"
            : preview
              ? "Refresh estimate"
              : "Review estimate"}
          <Icon name="arrow" />
        </button>
      </form>
    </section>
  );
}
