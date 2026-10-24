"use server";

import { ApiError, apiRequest } from "@/lib/api";
import type { TradeDraft, TradePreview, TradeResult } from "@/types";

const requestIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const artistIdPattern = /^\d+$/;

export async function submitTrade(draft: TradeDraft): Promise<TradeResult> {
  if (
    !artistIdPattern.test(draft.artistId) ||
    !requestIdPattern.test(draft.requestId) ||
    (draft.side !== "buy" && draft.side !== "sell") ||
    !Number.isSafeInteger(draft.quantity) ||
    draft.quantity <= 0 ||
    draft.quantity > 1_000_000
  ) {
    return {
      ok: false,
      code: "validation_error",
      message: "Check the trade details and try again.",
    };
  }

  try {
    return await apiRequest<TradeResult>("/api/v1/trades", {
      method: "POST",
      body: JSON.stringify({
        artistId: draft.artistId,
        side: draft.side,
        quantity: draft.quantity,
        requestId: draft.requestId,
        quoteVersion: draft.quoteVersion,
      }),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, code: error.code, message: error.message };
    }
    return {
      ok: false,
      code: "service_unavailable",
      message: "Trading is temporarily unavailable.",
    };
  }
}

export async function previewTrade(
  draft: TradeDraft,
): Promise<TradePreview | { error: string }> {
  if (
    !artistIdPattern.test(draft.artistId) ||
    !requestIdPattern.test(draft.requestId) ||
    !Number.isSafeInteger(draft.quantity) ||
    draft.quantity < 1 ||
    draft.quantity > 1_000_000 ||
    !["buy", "sell"].includes(draft.side)
  )
    return { error: "Check the order details." };
  try {
    return await apiRequest<TradePreview>("/api/v1/trades/preview", {
      method: "POST",
      body: JSON.stringify(draft),
    });
  } catch (error) {
    return {
      error:
        error instanceof ApiError
          ? error.message
          : "An estimate is temporarily unavailable.",
    };
  }
}
