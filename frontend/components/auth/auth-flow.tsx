"use client";
import Link from "next/link";
import { useHydrated } from "@/lib/use-hydrated";
import { useRef, useState, useTransition, useEffect } from "react";
import {
  login,
  signup,
  verifyPhone,
  resendVerification,
  requestRecovery,
  resetPassword,
  attachPhone,
  resendEmail,
  type AuthState,
} from "@/actions/auth";

export function AuthFlow({
  mode,
  nextPath = "/market",
}: {
  mode: "login" | "signup" | "recover" | "reset" | "attach";
  nextPath?: string;
}) {
  const hydrated = useHydrated();
  const [state, setState] = useState<AuthState>({ error: null });
  const [stage, setStage] = useState("entry");
  const [method, setMethod] = useState(mode === "reset" ? "email" : "phone");
  const [phone, setPhone] = useState("");
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
    if (result.phone) setPhone(result.phone);
    if (result.retryAfter) {
      const now = Date.now();
      setClock(now);
      setUntil(now + result.retryAfter * 1000);
    }
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const action =
      mode === "login" && stage === "entry"
        ? login
        : mode === "reset"
          ? resetPassword
          : stage === "verify"
            ? mode === "recover"
              ? resetPassword
              : verifyPhone
            : mode === "signup"
              ? signup
              : mode === "attach"
                ? attachPhone
                : requestRecovery;
    start(async () => {
      try {
        accept(await action({ error: null }, data));
      } catch {
        setState({
          error: "We could not reach the service. Please try again.",
        });
      }
    });
  }
  function resend() {
    if (!form.current || cooldown || pending) return;
    const data = new FormData(form.current);
    start(async () => {
      try {
        accept(
          await (mode === "recover" ? requestRecovery : resendVerification)(
            { error: null },
            data,
          ),
        );
      } catch {
        setState({ error: "The code could not be requested. Try again." });
      }
    });
  }
  if (stage === "done")
    return (
      <div className="space-y-4">
        <p role="status">{state.success}</p>
        <Link
          className="touch action-primary inline-flex items-center rounded-xl px-5"
          href="/login"
        >
          Back to sign in
        </Link>
      </div>
    );
  const password =
    (mode === "login" && stage === "entry") ||
    (mode === "signup" && stage === "entry") ||
    mode === "reset" ||
    (mode === "recover" && stage === "verify");
  return (
    <form
      ref={form}
      onSubmit={submit}
      className="mt-6 space-y-5"
      aria-busy={pending}
    >
      <fieldset disabled={!hydrated} className="min-w-0 space-y-5">
        <input type="hidden" name="next" value={nextPath} />
        <input type="hidden" name="method" value={method} />
        <input
          type="hidden"
          name="purpose"
          value={mode === "attach" ? "attach" : "signup"}
        />
        {(mode === "login" || mode === "recover") && stage === "entry" && (
          <div className="flex gap-2" aria-label="Sign-in method">
            {["phone", "email"].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={method === value}
                className={`touch flex-1 rounded-xl border border-white/15 px-3 ${method === value ? "nav-active" : ""}`}
                onClick={() => {
                  setMethod(value);
                  setState({ error: null });
                }}
              >
                {value === "phone" ? "Phone" : "Existing email account"}
              </button>
            ))}
          </div>
        )}
        {stage === "verify" ? (
          <>
            <p>
              Code sent to <strong>•••• {phone.slice(-4)}</strong>
            </p>
            <input type="hidden" name="country" value="+1" />
            <input type="hidden" name="phone" value={phone} />
            <label className="block">
              SMS verification code
              <input
                className="auth-input mt-2"
                name="token"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
              />
            </label>
            <button
              className="touch text-sm text-sky-200 underline"
              type="button"
              disabled={pending}
              onClick={() => {
                setStage("entry");
                setState({ error: null });
              }}
            >
              Correct phone number
            </button>
          </>
        ) : (
          mode !== "reset" &&
          (method === "phone" ? (
            <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
              <label>
                Country code
                <input
                  className="auth-input mt-2"
                  name="country"
                  aria-label="Country code"
                  defaultValue="+1"
                  type="tel"
                  autoComplete="tel-country-code"
                  required
                />
              </label>
              <label>
                Phone number
                <input
                  className="auth-input mt-2"
                  type="tel"
                  name="phone"
                  autoComplete="tel-national"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </label>
            </div>
          ) : (
            <label className="block">
              Email
              <input
                className="auth-input mt-2"
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
          ))
        )}
        {password && (
          <label className="block">
            {mode === "recover" || mode === "reset"
              ? "New password"
              : "Password"}
            <input
              className="auth-input mt-2"
              type="password"
              name="password"
              aria-label={
                mode === "recover" || mode === "reset"
                  ? "New password"
                  : "Password"
              }
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={mode === "login" ? undefined : 8}
              maxLength={128}
              required
            />
            {mode !== "login" && (
              <span className="mt-2 block text-xs text-slate-400">
                Use 8–128 characters.
              </span>
            )}
          </label>
        )}
        {state.error && (
          <p
            role="alert"
            className="rounded-xl bg-rose-400/10 p-3 text-sm text-rose-200"
          >
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="text-sm text-sky-100">
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
            : mode === "login" && stage === "entry"
              ? "Sign in"
              : mode === "reset" || (mode === "recover" && stage === "verify")
                ? "Set new password"
                : stage === "verify"
                  ? "Verify phone"
                  : mode === "signup"
                    ? "Create account"
                    : mode === "attach"
                      ? "Attach phone"
                      : "Send recovery code or link"}
        </button>
        {stage === "verify" && (
          <button
            type="button"
            onClick={resend}
            disabled={pending || cooldown > 0}
            className="touch w-full rounded-xl border border-white/20 px-4"
          >
            {cooldown
              ? `Resend code in ${cooldown}s`
              : "Resend verification code"}
          </button>
        )}
        {mode === "login" && stage === "entry" && (
          <>
            {method === "phone" && (
              <button
                type="button"
                disabled={pending || cooldown > 0}
                className="touch text-sm text-sky-200"
                onClick={() => {
                  if (!form.current) return;
                  const data = new FormData(form.current);
                  start(async () => {
                    try {
                      accept(await resendVerification({ error: null }, data));
                    } catch {
                      setState({
                        error:
                          "Verification could not be requested. Try again.",
                      });
                    }
                  });
                }}
              >
                Verify an unconfirmed phone account
              </button>
            )}
            <Link
              className="touch flex items-center text-sm text-sky-200"
              href={`/recover?next=${encodeURIComponent(nextPath)}`}
            >
              Forgot password?
            </Link>
            {method === "email" && (
              <button
                type="button"
                className="touch text-sm text-sky-200"
                disabled={pending || cooldown > 0}
                onClick={() => {
                  if (!form.current) return;
                  const data = new FormData(form.current);
                  start(async () => {
                    try {
                      accept(await resendEmail({ error: null }, data));
                    } catch {
                      setState({
                        error:
                          "Verification could not be requested. Try again.",
                      });
                    }
                  });
                }}
              >
                {cooldown
                  ? `Resend verification in ${cooldown}s`
                  : "Resend email verification"}
              </button>
            )}
          </>
        )}
      </fieldset>
    </form>
  );
}
