export const ONBOARDING_KEY = "artiste:onboarding:v1";

export interface OnboardingState {
  version: number;
  step: number;
  completed: boolean;
}

export function parseOnboarding(value: unknown): OnboardingState | null {
  try {
    const state = typeof value === "string" ? JSON.parse(value) : value;
    if (
      !state ||
      state.version !== 1 ||
      !Number.isInteger(state.step) ||
      state.step < 0 ||
      state.step > 2 ||
      typeof state.completed !== "boolean"
    )
      return null;
    return { version: 1, step: state.step, completed: state.completed };
  } catch {
    return null;
  }
}

export function readOnboarding(): OnboardingState | null {
  try {
    return parseOnboarding(localStorage.getItem(ONBOARDING_KEY));
  } catch {
    return null;
  }
}

export function clearOnboarding() {
  try {
    localStorage.removeItem(ONBOARDING_KEY);
  } catch {
    // Account progress remains available through FastAPI.
  }
}
