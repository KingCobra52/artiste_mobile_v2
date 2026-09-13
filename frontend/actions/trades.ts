"use server";

import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import type { TradeDraft, TradeResult } from "@/types";

const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const artistIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function submitTrade(draft: TradeDraft): Promise<TradeResult> {
  if (!getSupabaseConfig().configured) {
    return {
      ok: false,
      code: "configuration_error",
      message: "Trading is unavailable until Supabase is configured.",
    };
  }

  const fieldErrors: NonNullable<Extract<TradeResult, { ok: false }>["fieldErrors"]> = {};
  if (!artistIdPattern.test(draft.artistId)) fieldErrors.artistId = "Choose a valid artist.";
  if (draft.side !== "buy" && draft.side !== "sell") fieldErrors.side = "Choose buy or sell.";
  if (!Number.isSafeInteger(draft.quantity) || draft.quantity <= 0) {
    fieldErrors.quantity = "Enter a positive whole number of shares.";
  }
  if (!requestIdPattern.test(draft.requestId)) fieldErrors.requestId = "Start a new trade request.";

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      code: "validation_error",
      message: "Check the trade details and try again.",
      fieldErrors,
    };
  }

  const supabase = await createClient();
  if (!supabase) {
    return { ok: false, code: "configuration_error", message: "Supabase is not configured." };
  }

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    return { ok: false, code: "unauthenticated", message: "Sign in before placing a trade." };
  }

  return {
    ok: false,
    code: "not_connected",
    message: "Trading is not connected yet. Your portfolio was not changed.",
  };
}
