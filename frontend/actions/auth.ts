"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/navigation";

export interface AuthState {
  error: string | null;
  success?: string | null;
  stage?: "entry" | "done";
  email?: string;
  retryAfter?: number;
}
export type SignUpState = AuthState;

function emailAddress(form: FormData): string {
  return String(form.get("email") ?? "").trim();
}
function validEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function validPassword(value: string) {
  return value.length >= 8 && value.length <= 128;
}
function authCallback(
  site: string,
  options: { next?: unknown; recovery?: boolean } = {},
) {
  const callback = new URL("/auth/callback", site);
  if (options.recovery) callback.searchParams.set("recovery", "1");
  else callback.searchParams.set("next", safeNextPath(options.next));
  return callback.toString();
}
function failure(
  message: string,
  error?: { status?: number } | null,
): AuthState {
  return {
    error:
      error?.status === 429
        ? "Too many attempts. Please wait before trying again."
        : message,
    retryAfter: error?.status === 429 ? 60 : undefined,
  };
}

export async function login(
  _state: AuthState,
  form: FormData,
): Promise<AuthState> {
  const client = await createClient();
  if (!client) return failure("Authentication is not configured.");
  const email = emailAddress(form);
  const password = String(form.get("password") ?? "");
  if (!validEmail(email) || !password)
    return failure("Enter a valid email and password.");
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error)
    return failure(
      "The email or password is incorrect. Verify your email if you just signed up.",
      error,
    );
  redirect(
    `/auth/continue?next=${encodeURIComponent(safeNextPath(form.get("next")))}`,
  );
}

export async function signup(
  _state: AuthState,
  form: FormData,
): Promise<AuthState> {
  const client = await createClient();
  if (!client) return failure("Authentication is not configured.");
  const email = emailAddress(form);
  const password = String(form.get("password") ?? "");
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!validEmail(email) || !validPassword(password))
    return failure("Enter a valid email and a password of 8–128 characters.");
  if (!site) return failure("Email verification is not configured.");
  const next = safeNextPath(form.get("next"));
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: authCallback(site, { next }) },
  });
  if (error)
    return failure(
      "We could not create this account. Check your details or try again later.",
      error,
    );
  if (data.session)
    redirect(`/auth/continue?next=${encodeURIComponent(next)}`);
  return {
    error: null,
    stage: "done",
    email,
    success: "Check your email for a link to verify your account.",
  };
}

export async function requestRecovery(
  _state: AuthState,
  form: FormData,
): Promise<AuthState> {
  const client = await createClient();
  if (!client) return failure("Authentication is not configured.");
  const email = emailAddress(form);
  if (!validEmail(email)) return failure("Enter a valid email address.");
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!site) return failure("Account recovery is temporarily unavailable.");
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: authCallback(site, { recovery: true }),
  });
  if (error)
    return failure(
      "Recovery could not be requested. Please try again later.",
      error,
    );
  return {
    error: null,
    stage: "done",
    success: "If an account exists, check your email for a recovery link.",
  };
}

export async function resetPassword(
  _state: AuthState,
  form: FormData,
): Promise<AuthState> {
  const client = await createClient();
  if (!client) return failure("Authentication is not configured.");
  const password = String(form.get("password") ?? "");
  if (!validPassword(password))
    return failure("Use a password between 8 and 128 characters.");
  const { data } = await client.auth.getUser();
  if (!data.user)
    return failure("Your recovery session expired. Request a new recovery email.");
  const { error } = await client.auth.updateUser({ password });
  if (error)
    return failure(
      "The password could not be changed. Please request a new recovery email.",
      error,
    );
  await client.auth.signOut({ scope: "global" });
  redirect("/login?reset=1");
}

export async function resendEmail(
  _state: AuthState,
  form: FormData,
): Promise<AuthState> {
  const client = await createClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const email = emailAddress(form);
  if (!client || !site)
    return failure("Email verification is not configured.");
  if (!validEmail(email)) return failure("Enter a valid email address.");
  const { error } = await client.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: authCallback(site, { next: form.get("next") }) },
  });
  if (error)
    return failure("Verification could not be resent. Try again later.", error);
  return {
    error: null,
    stage: "done",
    email,
    success: "If verification is needed, check your email.",
    retryAfter: 60,
  };
}

export async function logout() {
  const client = await createClient();
  if (client) await client.auth.signOut();
  redirect("/onboarding");
}

export async function switchAccount(
  target: "login" | "signup",
  destination: string,
): Promise<{
  destination?: string;
  error?: string;
}> {
  const next = safeNextPath(destination);
  if (target !== "login" && target !== "signup")
    return { error: "Choose an account option." };
  try {
    const client = await createClient();
    if (!client) return { error: "Authentication is not configured." };
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error)
      return {
        error: "We could not sign out of this session. Please try again.",
      };
    return { destination: `/${target}?next=${encodeURIComponent(next)}` };
  } catch {
    return { error: "We could not reach the service. Please try again." };
  }
}
