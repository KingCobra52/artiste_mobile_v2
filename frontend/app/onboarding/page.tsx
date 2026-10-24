import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { ConfigurationNotice } from "@/components/ui/configuration-notice";
import { apiRequest } from "@/lib/api";
import type { OnboardingState } from "@/actions/onboarding";
import { safeNextPath } from "@/lib/navigation";
export const dynamic = "force-dynamic";
export const metadata = { title: "How Artiste works" };
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; replay?: string }>;
}) {
  if (!getSupabaseConfig().configured) return <ConfigurationNotice />;
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const client = await createClient();
  const { data, error } = await client!.auth.getClaims();
  const authenticated = !error && Boolean(data?.claims);
  let state: OnboardingState | null = null;
  if (authenticated) {
    try {
      state = await apiRequest<OnboardingState>("/api/v1/onboarding");
    } catch {
      /* Show onboarding with retry if the API is unavailable. */
    }
  }
  if (state?.completed && !params.replay) redirect(next);
  return (
    <OnboardingFlow
      key={params.replay ? "replay" : "start"}
      state={state}
      authenticated={authenticated}
      replay={Boolean(params.replay)}
      nextPath={next}
    />
  );
}
