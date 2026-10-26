import { AuthPage } from "@/components/auth/auth-page";
import { AuthContinuation } from "@/components/auth/auth-continuation";
import { safeNextPath } from "@/lib/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Continue to Artiste" };

export default async function ContinuePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNextPath((await searchParams).next);
  return (
    <AuthPage
      title="You’re signed in"
      description="Getting your account ready."
    >
      <AuthContinuation nextPath={next} />
    </AuthPage>
  );
}
