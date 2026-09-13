"use client";

import { useActionState } from "react";
import { login, type AuthState } from "@/actions/auth";

const initialState: AuthState = { error: null };

export function LoginForm({ nextPath = "/market" }: { nextPath?: string }) {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <input type="hidden" name="next" value={nextPath} />
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-200">Email</span>
        <input
          className="min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 text-base text-white outline-none transition focus:border-lime-300 focus:ring-2 focus:ring-lime-300/20"
          type="email"
          name="email"
          autoComplete="email"
          required
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-200">Password</span>
        <input
          className="min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 text-base text-white outline-none transition focus:border-lime-300 focus:ring-2 focus:ring-lime-300/20"
          type="password"
          name="password"
          autoComplete="current-password"
          required
        />
      </label>
      {state.error && <p role="alert" className="text-sm text-rose-300">{state.error}</p>}
      <button
        className="min-h-12 w-full rounded-xl bg-lime-300 px-5 font-semibold text-slate-950 transition hover:bg-lime-200 disabled:cursor-wait disabled:opacity-60"
        type="submit"
        disabled={pending}
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
