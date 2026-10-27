import type { User } from "@supabase/supabase-js";

export function isVerifiedUser(user: User | null | undefined): boolean {
  return Boolean(
    user &&
      !user.is_anonymous &&
      user.email_confirmed_at,
  );
}
