"use server";
import { apiRequest } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { isVerifiedUser } from "@/lib/supabase/verified-user";
import { safeNextPath } from "@/lib/navigation";
import { parseOnboarding, type OnboardingState } from "@/lib/onboarding";
export type { OnboardingState } from "@/lib/onboarding";
export async function saveOnboarding(state: OnboardingState): Promise<boolean> {
  if (!parseOnboarding(state)) return false;
  try {
    if (!state.completed) {
      const existing = await apiRequest<OnboardingState>("/api/v1/onboarding");
      if (existing.completed) return true;
    }
    await apiRequest("/api/v1/onboarding", {
      method: "PATCH",
      body: JSON.stringify(state),
    });
    return true;
  } catch {
    return false;
  }
}

export async function completeAuthHandoff(
  progress: unknown,
  destination: string,
): Promise<{
  destination?: string;
  error?: string;
  completed?: boolean;
}> {
  const next = safeNextPath(destination);
  try {
    const client = await createClient();
    const result = client ? await client.auth.getUser() : null;
    if (!result || result.error || !isVerifiedUser(result.data.user)) {
      return {
        destination: `/login?verify=1&next=${encodeURIComponent(next)}`,
      };
    }
    const state = await apiRequest<OnboardingState>("/api/v1/onboarding");
    const local = parseOnboarding(progress);
    if (state.completed) return { destination: next, completed: true };
    if (local?.completed) {
      if (!(await saveOnboarding(local)))
        throw new Error("Progress unavailable");
      return { destination: next, completed: true };
    }
    return { destination: `/onboarding?next=${encodeURIComponent(next)}` };
  } catch {
    return {
      error: "We could not save your introduction progress. Please try again.",
    };
  }
}
