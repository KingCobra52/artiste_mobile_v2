import "server-only";

import { createClient } from "@/lib/supabase/server";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const baseUrl = process.env.ARTISTE_API_URL?.trim();
  if (!baseUrl) {
    throw new ApiError("The Artiste API is not configured yet.", 503, "configuration_error");
  }

  const supabase = await createClient();
  if (!supabase) {
    throw new ApiError("Supabase is not configured.", 503, "configuration_error");
  }
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new ApiError("Sign in to continue.", 401, "unauthenticated");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${data.session.access_token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch {
    throw new ApiError("The Artiste service is temporarily unavailable.", 503, "service_unavailable");
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      typeof payload?.message === "string" ? payload.message : "The request could not be completed.",
      response.status,
      typeof payload?.code === "string" ? payload.code : "request_failed",
    );
  }
  return payload as T;
}

export function displayApiError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "We could not load this data. Please try again.";
}
