import Link from "next/link";
import { AccountChoice } from "@/components/auth/account-choice";
import { createClient } from "@/lib/supabase/server";
import { isVerifiedUser } from "@/lib/supabase/verified-user";
import { redirect } from "next/navigation";
import { AuthPage } from "@/components/auth/auth-page";
import { SignUpForm } from "@/components/auth/signup-form";
import { safeNextPath } from "@/lib/navigation";
export const dynamic = "force-dynamic";
export const metadata = { title: "Create account" };
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNextPath((await searchParams).next);
  const client = await createClient();
  const result = client ? await client.auth.getUser() : null;
  const user = !result?.error ? result?.data.user : null;
  if (user && !isVerifiedUser(user))
    redirect(`/login?verify=1&next=${encodeURIComponent(next)}`);
  if (user && isVerifiedUser(user)) {
    const account = user.email
      ? `${user.email.slice(0, 1)}•••@${user.email.split("@")[1] ?? "your account"}`
      : "your existing account";
    return (
      <AuthPage
        title="Choose your account"
        description="Continue with your signed-in account, or choose another account."
      >
        <AccountChoice account={account} nextPath={next} />
      </AuthPage>
    );
  }
  return (
    <AuthPage
      title="Create your account"
      description="Verify your email to start with $10,000 in virtual cash."
    >
      <SignUpForm nextPath={next} />
      <Link
        className="touch mt-4 flex items-center text-sm text-accent"
        href={`/login?next=${encodeURIComponent(next)}`}
      >
        Already have an account? Sign in
      </Link>
    </AuthPage>
  );
}
