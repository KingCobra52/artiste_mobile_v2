"use client";

import { useActionState } from "react";
import { signup, type SignUpState } from "@/actions/auth";

const initialState: SignUpState = { error: null, success: null };

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signup, initialState);

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-200">Email</span>
        <input
          className="min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 text-base text-white outline-none focus:border-lime-300 focus:ring-2 focus:ring-lime-300/20"
          type="email"
          name="email"
          autoComplete="email"
          required
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-200">Password</span>
        <input
          className="min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 text-base text-white outline-none focus:border-lime-300 focus:ring-2 focus:ring-lime-300/20"
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
        />
        <span className="mt-2 block text-xs text-slate-500">At least 8 characters.</span>
      </label>
      {state.error && <p role="alert" className="text-sm text-rose-300">{state.error}</p>}
      {state.success && <p role="status" className="rounded-xl bg-emerald-300/10 px-3 py-3 text-sm text-emerald-100">{state.success}</p>}
      <button
        className="min-h-12 w-full rounded-xl bg-lime-300 px-5 font-semibold text-slate-950 transition hover:bg-lime-200 disabled:cursor-wait disabled:opacity-60"
        type="submit"
        disabled={pending || Boolean(state.success)}
      >
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
