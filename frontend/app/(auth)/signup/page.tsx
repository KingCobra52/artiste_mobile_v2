import Link from "next/link";
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
  return (
    <AuthPage
      title="Create your account"
      description="Verify your phone to start with $10,000 in virtual cash."
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
