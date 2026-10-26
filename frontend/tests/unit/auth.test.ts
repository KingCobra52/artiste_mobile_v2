import { beforeEach, describe, expect, it, vi } from "vitest";
const { auth, createClient } = vi.hoisted(() => ({
  auth: {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    verifyOtp: vi.fn(),
    resend: vi.fn(),
    signInWithOtp: vi.fn(),
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
  verifyPhone,
  requestRecovery,
  resetPassword,
  attachPhone,
  resendVerification,
} from "@/actions/auth";
import { safeNextPath } from "@/lib/navigation";
function form(values: Record<string, string> = {}) {
  const data = new FormData();
  Object.entries({
    country: "+1",
    phone: "2125550100",
    password: "test-password-123",
    token: "123456",
    ...values,
  }).forEach(([key, value]) => data.set(key, value));
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  createClient.mockResolvedValue({ auth });
  Object.values(auth).forEach((fn) =>
    fn.mockResolvedValue({
      data: { user: { id: "existing-user" } },
      error: null,
    }),
  );
});
describe("phone authentication", () => {
  it("signs up with normalized E.164 and never returns the password", async () => {
    const result = await signup({ error: null }, form());
    expect(auth.signUp).toHaveBeenCalledWith({
      phone: "+12125550100",
      password: "test-password-123",
    });
    expect(result.stage).toBe("verify");
    expect(JSON.stringify(result)).not.toContain("test-password-123");
  });
  it("rejects malformed contact/password without a provider call", async () => {
    expect(
      (await signup({ error: null }, form({ phone: "abc", password: "short" })))
        .error,
    ).toBeTruthy();
    expect(auth.signUp).not.toHaveBeenCalled();
  });
  it("preserves the intended route after login", async () => {
    await expect(
      login({ error: null }, form({ next: "/artists/16?range=month" })),
    ).rejects.toThrow(
      "REDIRECT:/auth/continue?next=%2Fartists%2F16%3Frange%3Dmonth",
    );
  });
  it("retains login for existing email accounts", async () => {
    await expect(
      login(
        { error: null },
        form({ method: "email", email: "existing@example.com" }),
      ),
    ).rejects.toThrow("REDIRECT:");
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: "existing@example.com",
      password: "test-password-123",
    });
  });
  it("does not create accounts during SMS recovery", async () => {
    await requestRecovery({ error: null }, form());
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      phone: "+12125550100",
      options: { shouldCreateUser: false },
    });
  });
  it.each(["expired", "incorrect", "reused"])(
    "does not change password for an %s code",
    async () => {
      auth.verifyOtp.mockResolvedValue({ error: { message: "expired" } });
      expect((await resetPassword({ error: null }, form())).error).toBeTruthy();
      expect(auth.updateUser).not.toHaveBeenCalled();
    },
  );
  it("resets password only after SMS verification and signs out sessions", async () => {
    await expect(resetPassword({ error: null }, form())).rejects.toThrow(
      "REDIRECT:/login?reset=1",
    );
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      phone: "+12125550100",
      token: "123456",
      type: "sms",
    });
    expect(auth.updateUser).toHaveBeenCalledWith({
      password: "test-password-123",
    });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "global" });
  });
  it("attaches a phone to the existing identity without signup", async () => {
    await attachPhone({ error: null }, form());
    expect(auth.updateUser).toHaveBeenCalledWith({ phone: "+12125550100" });
    expect(auth.signUp).not.toHaveBeenCalled();
  });
  it("rejects a phone-change result belonging to another identity", async () => {
    auth.verifyOtp.mockResolvedValue({
      data: { user: { id: "other" } },
      error: null,
    });
    expect(
      (await verifyPhone({ error: null }, form({ purpose: "attach" }))).error,
    ).toBeTruthy();
    expect(auth.signOut).toHaveBeenCalled();
  });
  it("exposes a retry interval for rate limits", async () => {
    auth.resend.mockResolvedValue({ error: { status: 429 } });
    const result = await resendVerification({ error: null }, form());
    expect(result.retryAfter).toBe(60);
    expect(result.error).toContain("wait");
  });
});
describe("verification retry handling", () => {
  it("returns verified destination and cooldown when resending", async () => {
    const result = await resendVerification({ error: null }, form());
    expect(result).toMatchObject({
      phone: "+12125550100",
      stage: "verify",
      retryAfter: 60,
    });
    expect(auth.resend).toHaveBeenCalledWith({
      type: "sms",
      phone: "+12125550100",
    });
  });
  it("shows temporary delivery failures during recovery", async () => {
    auth.signInWithOtp.mockResolvedValue({ error: { status: 500 } });
    expect((await requestRecovery({ error: null }, form())).error).toContain(
      "delivery",
    );
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
    ));
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
  it("uses the handoff after phone verification", async () => {
    await expect(
      verifyPhone({ error: null }, form({ next: "/portfolio" })),
    ).rejects.toThrow("REDIRECT:/auth/continue?next=%2Fportfolio");
  });
});

describe("phone verification failures", () => {
  it.each(["expired", "incorrect", "already used"])(
    "keeps an %s OTP on verification",
    async (message) => {
      auth.verifyOtp.mockResolvedValue({
        data: { user: null },
        error: { message, status: 403 },
      });
      const result = await verifyPhone({ error: null }, form());
      expect(result.error).toContain("incorrect, expired or already used");
      expect(result.stage).not.toBe("done");
    },
  );
});
