export interface SupabasePublicConfig {
  url: string;
  publishableKey: string;
}

export type SupabaseConfigResult =
  | { configured: true; value: SupabasePublicConfig }
  | { configured: false; missing: string[] };

export function getSupabaseConfig(): SupabaseConfigResult {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const missing: string[] = [];

  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!publishableKey) missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  if (missing.length > 0) return { configured: false, missing };

  return {
    configured: true,
    value: { url: url as string, publishableKey: publishableKey as string },
  };
}
