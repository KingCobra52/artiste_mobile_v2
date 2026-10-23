"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export interface AuthState {
  error: string | null;
}

export interface SignUpState {
  error: string | null;
  success: string | null;
}

function safeNextPath(value: FormDataEntryValue | null): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/market";
  }
  return value;
}

export async function login(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!getSupabaseConfig().configured) {
    return { error: "Supabase is not configured. Add the public URL and publishable key first." };
  }

  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase is not configured." };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "The email or password is incorrect." };

  redirect(safeNextPath(formData.get("next")));
}

export async function signup(
  _previousState: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  if (!getSupabaseConfig().configured) {
    return { error: "Supabase is not configured. Please try again later.", success: null };
  }

  const emailValue = formData.get("email");
  const passwordValue = formData.get("password");
  if (typeof emailValue !== "string" || typeof passwordValue !== "string") {
    return { error: "Enter a valid email and password.", success: null };
  }
  const email = emailValue.trim().toLowerCase();
  const password = passwordValue;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address.", success: null };
  }
  if (password.length < 8 || password.length > 128) {
    return { error: "Use a password between 8 and 128 characters.", success: null };
  }

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase is not configured.", success: null };

  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: new URL("/auth/callback", origin).toString() },
  });
  if (error) {
    return {
      error: "We could not create that account. Check the email address or try again later.",
      success: null,
    };
  }
  return {
    error: null,
    success: "Check your email for a verification link. Your paper portfolio will be ready after verification.",
  };
}

export async function logout() {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/login");
}
