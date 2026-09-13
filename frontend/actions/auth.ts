"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export interface AuthState {
  error: string | null;
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

export async function logout() {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/login");
}
