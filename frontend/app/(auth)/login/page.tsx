import Link from "next/link";
import { AuthPage } from "@/components/auth/auth-page";
import { LoginForm } from "@/components/auth/login-form";
import { safeNextPath } from "@/lib/navigation";
export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; reset?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  return (
    <AuthPage
      title="Welcome back"
      description="Sign in with your phone number and password, or use your existing email account."
    >
      {params.error && (
        <p role="alert" className="mt-3 text-rose-200">
          We could not finish authentication. Please try again.
        </p>
      )}
      {params.reset && (
        <p role="status" className="mt-3 text-sky-100">
          Password updated. Sign in with your new password.
        </p>
      )}
      <LoginForm nextPath={next} />
      <Link
        className="touch mt-4 flex items-center text-sm text-sky-200"
        href={`/signup?next=${encodeURIComponent(next)}`}
      >
        Create an account
      </Link>
    </AuthPage>
  );
}
