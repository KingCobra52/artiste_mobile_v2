"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/navigation";

export interface AuthState {
  error: string | null;
  success?: string | null;
  stage?: "entry" | "verify" | "done";
  phone?: string;
  retryAfter?: number;
}
export type SignUpState = AuthState;

function phoneNumber(form: FormData): string | null {
  const raw = String(form.get("phone") ?? "").trim();
  const country = String(form.get("country") ?? "+1").trim();
  if (!/^[+\d\s().-]+$/.test(raw) || !/^\+\d{1,4}$/.test(country)) return null;
  const value = raw.startsWith("+")
    ? raw.replace(/[\s().-]/g, "")
    : country + raw.replace(/[\s().-]/g, "");
  return /^\+[1-9]\d{7,14}$/.test(value) ? value : null;
}
function validPassword(value: string) {
  return value.length >= 8 && value.length <= 128;
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
  const password = String(form.get("password") ?? "");
  const email = String(form.get("email") ?? "").trim();
  const phone = phoneNumber(form);
  const emailMode = form.get("method") === "email";
  if (!password || (emailMode ? !email : !phone))
    return failure("Enter your contact details and password.");
  const { error } = await client.auth.signInWithPassword(
    emailMode ? { email, password } : { phone: phone!, password },
  );
  if (error)
    return failure(
      "The contact details or password are incorrect. Verify your account if you have just signed up.",
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
  const phone = phoneNumber(form);
  if (!client) return failure("Authentication is not configured.");
  const password = String(form.get("password") ?? "");
  if (!phone || !validPassword(password))
    return failure(
      "Enter a valid phone number and a password of 8–128 characters.",
    );
  const { error } = await client.auth.signUp({ phone, password });
  if (error)
    return failure(
      "We could not create this account. Check your details or try again later.",
      error,
    );
  return {
    error: null,
    stage: "verify",
    phone,
    retryAfter: 60,
    success: "Enter the SMS code to verify your phone.",
  };
}
export async function verifyPhone(
  _state: AuthState,
  form: FormData,
): Promise<AuthState> {
  const client = await createClient();
  const phone = phoneNumber(form);
  const token = String(form.get("token") ?? "").trim();
  if (!client || !phone || !/^\d{6}$/.test(token))
    return failure("Enter the six-digit SMS code.");
  const change = form.get("purpose") === "attach";
  const existing = change ? await client.auth.getUser() : null;
  if (change && !existing?.data.user)
    return failure("Sign in before attaching a phone number.");
  const { data, error } = await client.auth.verifyOtp({
    phone,
    token,
    type: change ? "phone_change" : "sms",
  });
  if (error)
    return failure(
      "The code is incorrect, expired or already used. Request another code if needed.",
      error,
    );
  if (change) {
    if (data.user?.id !== existing!.data.user!.id) {
      await client.auth.signOut();
      return failure("We could not verify this account change.");
    }
    return {
      error: null,
      stage: "done",
      success: "Phone verified on your existing account.",
    };
  }
  redirect(
    `/auth/continue?next=${encodeURIComponent(safeNextPath(form.get("next")))}`,
  );
}
export async function resendVerification(
  _state: AuthState,
  form: FormData,
): Promise<AuthState> {
  const client = await createClient();
  const phone = phoneNumber(form);
  if (!client || !phone) return failure("Enter a valid phone number.");
  const { error } = await client.auth.resend({
    type: form.get("purpose") === "attach" ? "phone_change" : "sms",
    phone,
  });
  if (error)
    return failure(
      "The code could not be sent. Wait a moment, check the number, and try again.",
      error,
    );
  return {
    error: null,
    stage: "verify",
    phone,
    success: "Another verification code was requested.",
    retryAfter: 60,
  };
}
export async function requestRecovery(
  _state: AuthState,
  form: FormData,
): Promise<AuthState> {
  const client = await createClient();
  if (!client) return failure("Authentication is not configured.");
  if (form.get("method") === "email") {
    const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (!site) return failure("Account recovery is temporarily unavailable.");
    const email = String(form.get("email") ?? "").trim();
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: new URL("/auth/callback?recovery=1", site).toString(),
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
  const phone = phoneNumber(form);
  if (!phone) return failure("Enter a valid phone number.");
  const { error } = await client.auth.signInWithOtp({
    phone,
    options: { shouldCreateUser: false },
  });
  if (error?.status === 429)
    return failure("Please wait before requesting another code.", error);
  if (error?.status && error.status >= 500)
    return failure(
      "SMS delivery is temporarily unavailable. Try again later.",
      error,
    );
  // Do not reveal whether a phone number belongs to an account.
  return {
    error: null,
    stage: "verify",
    phone,
    retryAfter: 60,
    success:
      "If this phone belongs to an account, a recovery code has been requested.",
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
  if (form.get("method") !== "email") {
    const phone = phoneNumber(form);
    const token = String(form.get("token") ?? "").trim();
    if (!phone || !/^\d{6}$/.test(token))
      return failure("Enter the six-digit recovery code.");
    const { error } = await client.auth.verifyOtp({
      phone,
      token,
      type: "sms",
    });
    if (error)
      return failure(
        "The code is incorrect, expired or already used. Request another code.",
        error,
      );
  } else {
    const { data } = await client.auth.getUser();
    if (!data.user)
      return failure(
        "Your recovery session expired. Request a new recovery email.",
      );
  }
  const { error } = await client.auth.updateUser({ password });
  if (error)
    return failure(
      "The password could not be changed. Please request a new recovery code or link.",
      error,
    );
  await client.auth.signOut({ scope: "global" });
  redirect("/login?reset=1");
}
export async function attachPhone(
  _state: AuthState,
  form: FormData,
): Promise<AuthState> {
  const client = await createClient();
  const phone = phoneNumber(form);
  if (!client || !phone) return failure("Enter a valid phone number.");
  const { data } = await client.auth.getUser();
  if (!data.user) return failure("Sign in before updating your account.");
  const { error } = await client.auth.updateUser({ phone });
  if (error)
    return failure(
      "This phone could not be attached. It may already belong to another account.",
      error,
    );
  return {
    error: null,
    stage: "verify",
    phone,
    retryAfter: 60,
    success:
      "Verify the SMS code. Your account and holdings will stay the same.",
  };
}
export async function resendEmail(
  _state: AuthState,
  form: FormData,
): Promise<AuthState> {
  const client = await createClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!client || !site) return failure("Email verification is not configured.");
  const { error } = await client.auth.resend({
    type: "signup",
    email: String(form.get("email") ?? ""),
    options: { emailRedirectTo: new URL("/auth/callback", site).toString() },
  });
  if (error)
    return failure("Verification could not be resent. Try again later.", error);
  return {
    error: null,
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
