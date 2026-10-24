"use server";
import { apiRequest } from "@/lib/api";
export interface OnboardingState {
  version: number;
  step: number;
  completed: boolean;
}
export async function saveOnboarding(state: OnboardingState): Promise<boolean> {
  try {
    await apiRequest("/api/v1/onboarding", {
      method: "PATCH",
      body: JSON.stringify(state),
    });
    return true;
  } catch {
    return false;
  }
}
