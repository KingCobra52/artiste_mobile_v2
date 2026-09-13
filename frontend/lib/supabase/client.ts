"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/lib/supabase/config";

export function createClient() {
  const config = getSupabaseConfig();
  if (!config.configured) return null;

  return createBrowserClient(config.value.url, config.value.publishableKey);
}
