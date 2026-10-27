import { beforeEach, describe, expect, it, vi } from "vitest";
const { auth, createClient } = vi.hoisted(() => ({
  auth: {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    resend: vi.fn(),
    updateUser: vi.fn(),
    signOut: vi.fn(),
    getUser: vi.fn(),
    resetPasswordForEmail: vi.fn(),
  },
  createClient: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));
import {
  switchAccount,
  signup,
  login,
  requestRecovery,
  resetPassword,
  resendEmail,
} from "@/actions/auth";
import { safeNextPath } from "@/lib/navigation";

function form(values: Record<string, string> = {}) {
  const data = new FormData();
  Object.entries({
    email: "person@example.com",
    password: "test-password-123",
    next: "/market",
    ...values,
  }).forEach(([key, value]) => data.set(key, value));
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env.NEXT_PUBLIC_SITE_URL = "https://artiste.example";
  createClient.mockResolvedValue({ auth });
  Object.values(auth).forEach((fn) =>
    fn.mockResolvedValue({
      data: { user: { id: "existing-user" }, session: null },
      error: null,
    }),
  );
});

describe("email and password authentication", () => {
  it("creates an email account with a confirmation callback and safe destination", async () => {
    const result = await signup(
      { error: null },
      form({ next: "/artists/16?range=month" }),
    );
    expect(auth.signUp).toHaveBeenCalledWith({
      email: "person@example.com",
      password: "test-password-123",
      options: {
        emailRedirectTo:
          "https://artiste.example/auth/callback?next=%2Fartists%2F16%3Frange%3Dmonth",
      },
    });
    expect(result).toMatchObject({
      error: null,
      stage: "done",
      email: "person@example.com",
    });
    expect(JSON.stringify(result)).not.toContain("test-password-123");
  });

  it("redirects directly when the provider returns a confirmed session", async () => {
    auth.signUp.mockResolvedValueOnce({
      data: { user: { id: "existing-user" }, session: { access_token: "x" } },
      error: null,
    });
    await expect(
      signup({ error: null }, form({ next: "/portfolio" })),
    ).rejects.toThrow("REDIRECT:/auth/continue?next=%2Fportfolio");
  });

  it("rejects malformed email or password without a provider call", async () => {
    expect(
      (await signup({ error: null }, form({ email: "bad", password: "short" })))
        .error,
    ).toBeTruthy();
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("requires the site URL to build a confirmation callback", async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect((await signup({ error: null }, form())).error).toContain(
      "verification is not configured",
    );
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("signs in existing email accounts and preserves the destination", async () => {
    await expect(
      login({ error: null }, form({ next: "/artists/16?range=month" })),
    ).rejects.toThrow(
      "REDIRECT:/auth/continue?next=%2Fartists%2F16%3Frange%3Dmonth",
    );
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: "person@example.com",
      password: "test-password-123",
    });
  });

  it("never accepts a phone-only sign-in submission", async () => {
    expect(
      (await login(
        { error: null },
        form({ email: "", phone: "+12125550100" }),
      )).error,
    ).toBeTruthy();
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("requests email recovery without revealing whether the account exists", async () => {
    const result = await requestRecovery({ error: null }, form());
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "person@example.com",
      {
        redirectTo:
          "https://artiste.example/auth/callback?recovery=1",
      },
    );
    expect(result.success).toContain("If an account exists");
  });

  it("requires a verified recovery session before changing the password", async () => {
    auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const result = await resetPassword({ error: null }, form());
    expect(result.error).toContain("recovery session expired");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("updates the password after email verification and signs out old sessions", async () => {
    await expect(resetPassword({ error: null }, form())).rejects.toThrow(
      "REDIRECT:/login?reset=1",
    );
    expect(auth.updateUser).toHaveBeenCalledWith({
      password: "test-password-123",
    });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "global" });
  });

  it("resends signup verification to the normalized callback", async () => {
    const result = await resendEmail(
      { error: null },
      form({ next: "/portfolio" }),
    );
    expect(auth.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "person@example.com",
      options: {
        emailRedirectTo:
          "https://artiste.example/auth/callback?next=%2Fportfolio",
      },
    });
    expect(result.retryAfter).toBe(60);
  });

  it("exposes a retry interval when email verification is rate limited", async () => {
    auth.resend.mockResolvedValue({ error: { status: 429 } });
    const result = await resendEmail({ error: null }, form());
    expect(result.retryAfter).toBe(60);
    expect(result.error).toContain("wait");
  });
});

describe("redirect normalization", () => {
  it.each([
    "//example.net",
    "/\\example.net",
    "/%5cexample.net",
    "/%255cexample.net",
    "https://example.net",
    "/\nexample.net",
    "/onboarding",
    "/auth/callback",
  ])("rejects unsafe or looping path %j", (value) => {
    expect(safeNextPath(value)).toBe("/market");
  });
  it("preserves a safe relative destination", () =>
    expect(safeNextPath("/artists/16?range=month#history")).toBe(
      "/artists/16?range=month#history",
    ),
  );
});

describe("account switching", () => {
  it("signs out only the current session and keeps the destination", async () => {
    expect(await switchAccount("login", "/portfolio")).toEqual({
      destination: "/login?next=%2Fportfolio",
    });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("keeps sign-out failures on the account choice screen", async () => {
    auth.signOut.mockResolvedValue({ error: { status: 500 } });
    const result = await switchAccount("signup", "/portfolio");
    expect(result.error).toContain("try again");
    expect(result.destination).toBeUndefined();
  });
});
