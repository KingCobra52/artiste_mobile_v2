"use client";

import Link from "next/link";
import { useHydrated } from "@/lib/use-hydrated";
import { useRef, useState, useTransition, useEffect } from "react";
import {
  login,
  signup,
  requestRecovery,
  resetPassword,
  resendEmail,
  type AuthState,
} from "@/actions/auth";

type AuthMode = "login" | "signup" | "recover" | "reset";

export function AuthFlow({
  mode,
  nextPath = "/market",
}: {
  mode: AuthMode;
  nextPath?: string;
}) {
  const hydrated = useHydrated();
  const [state, setState] = useState<AuthState>({ error: null });
  const [stage, setStage] = useState<"entry" | "done">("entry");
  const [email, setEmail] = useState("");
  const [until, setUntil] = useState(0);
  const [clock, setClock] = useState(0);
  const [pending, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const cooldown = Math.max(0, Math.ceil((until - clock) / 1000));
  function accept(result: AuthState) {
    setState(result);
    if (result.stage) setStage(result.stage);
    if (result.email) setEmail(result.email);
    if (result.retryAfter) {
      const now = Date.now();
      setClock(now);
      setUntil(now + result.retryAfter * 1000);
    }
  }

  function emailForm() {
    const data = new FormData();
    data.set("email", email);
    data.set("next", nextPath);
    return data;
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const action =
      mode === "login"
        ? login
        : mode === "signup"
          ? signup
          : mode === "recover"
            ? requestRecovery
            : resetPassword;
    start(async () => {
      try {
        accept(await action({ error: null }, data));
      } catch {
        setState({ error: "We could not reach the service. Please try again." });
      }
    });
  }

  function resendVerification() {
    if (!email || cooldown || pending) return;
    start(async () => {
      try {
        accept(await resendEmail({ error: null }, emailForm()));
      } catch {
        setState({ error: "Verification could not be requested. Try again." });
      }
    });
  }

  if (stage === "done")
    return (
      <div className="mt-6 space-y-4" aria-busy={pending}>
        <p role="status">{state.success}</p>
        {mode === "signup" && email && (
          <>
            <p>
              Confirmation email sent to <strong>{email}</strong>.
            </p>
            {state.error && <p role="alert">{state.error}</p>}
            <button
              type="button"
              className="touch w-full rounded-xl border border-line px-4"
              disabled={pending || cooldown > 0}
              onClick={resendVerification}
            >
              {cooldown
                ? `Resend verification in ${cooldown}s`
                : "Resend verification email"}
            </button>
          </>
        )}
        <Link
          className="touch action-primary inline-flex items-center rounded-xl px-5"
          href="/login"
        >
          Back to sign in
        </Link>
      </div>
    );

  const password = mode === "login" || mode === "signup" || mode === "reset";
  const newPassword = mode === "signup" || mode === "reset";
  return (
    <form
      ref={form}
      onSubmit={submit}
      className="auth-flow mt-6 space-y-5"
      aria-busy={pending}
    >
      <fieldset disabled={!hydrated} className="min-w-0 space-y-5">
        <input type="hidden" name="next" value={nextPath} />
        {mode !== "reset" && (
          <label className="block">
            Email
            <input
              className="auth-input mt-2"
              type="email"
              name="email"
              aria-label="Email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={254}
              required
            />
          </label>
        )}
        {password && (
          <label className="block">
            {mode === "reset" ? "New password" : "Password"}
            <input
              className="auth-input mt-2"
              type="password"
              name="password"
              aria-label={mode === "reset" ? "New password" : "Password"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={newPassword ? 8 : undefined}
              maxLength={128}
              required
            />
            {newPassword && (
              <span className="mt-2 block text-[0.8125rem] text-muted">
                Use 8–128 characters.
              </span>
            )}
          </label>
        )}
        {state.error && (
          <p
            role="alert"
            className="rounded-xl bg-surface-alt p-3 text-sm text-danger"
          >
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="text-sm text-accent">
            {state.success}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="touch action-primary w-full rounded-xl px-5 font-semibold"
        >
          {pending
            ? "Please wait…"
            : mode === "login"
              ? "Sign in"
              : mode === "signup"
                ? "Create account"
                : mode === "recover"
                  ? "Send recovery link"
                  : "Set new password"}
        </button>
        {mode === "login" && (
          <>
            <Link
              className="touch flex items-center text-sm text-accent"
              href={`/recover?next=${encodeURIComponent(nextPath)}`}
            >
              Forgot password?
            </Link>
            <button
              type="button"
              className="touch text-sm text-accent"
              disabled={pending || cooldown > 0}
              onClick={resendVerification}
            >
              {cooldown
                ? `Resend verification in ${cooldown}s`
                : "Resend email verification"}
            </button>
          </>
        )}
      </fieldset>
    </form>
  );
}
