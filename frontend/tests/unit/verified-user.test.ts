import { describe, expect, it } from "vitest";
import type { User } from "@supabase/supabase-js";
import { isVerifiedUser } from "@/lib/supabase/verified-user";

function user(values: Partial<User>): User {
  return { id: "test-user", app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "2026-01-01", ...values } as User;
}

describe("verified account gate", () => {
  it("accepts accounts with a confirmed email", () => {
    expect(isVerifiedUser(user({ email_confirmed_at: "2026-01-01" }))).toBe(true);
  });

  it("rejects missing, anonymous, phone-only, and unconfirmed accounts", () => {
    expect(isVerifiedUser(null)).toBe(false);
    expect(isVerifiedUser(user({}))).toBe(false);
    expect(isVerifiedUser(user({ phone_confirmed_at: "2026-01-01" }))).toBe(false);
    expect(isVerifiedUser(user({ is_anonymous: true, email_confirmed_at: "2026-01-01" }))).toBe(false);
  });
});
