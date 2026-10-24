import { OnboardingGate } from "@/components/onboarding/onboarding-gate";
import { apiRequest } from "@/lib/api";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/navigation/app-header";
import { BottomNavigation } from "@/components/navigation/bottom-navigation";
import { ConfigurationNotice } from "@/components/ui/configuration-notice";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!getSupabaseConfig().configured) return <ConfigurationNotice />;

  const supabase = await createClient();
  const { data, error } = await supabase!.auth.getClaims();
  if (error || !data?.claims) redirect("/login");

  let required = false;
  try {
    required = !(await apiRequest<{ completed: boolean }>("/api/v1/onboarding"))
      .completed;
  } catch {
    /* Data errors remain local to each page. */
  }

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <OnboardingGate required={required} />
      <a href="#main-content" className="sr-only focus:not-sr-only">
        Skip to content
      </a>
      <main
        id="main-content"
        className="mx-auto w-full max-w-5xl px-5 sm:px-8 pb-32 pt-8"
      >
        {children}
      </main>
      <BottomNavigation />
    </div>
  );
}
