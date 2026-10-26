import { OnboardingGate } from "@/components/onboarding/onboarding-gate";
import { apiRequest } from "@/lib/api";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/navigation/app-header";
import { BottomNavigation } from "@/components/navigation/bottom-navigation";
import { ConfigurationNotice } from "@/components/ui/configuration-notice";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { isVerifiedUser } from "@/lib/supabase/verified-user";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!getSupabaseConfig().configured) return <ConfigurationNotice />;

  const supabase = await createClient();
  const { data, error } = await supabase!.auth.getUser();
  if (error || !data.user) redirect("/onboarding");
  if (!isVerifiedUser(data.user)) redirect("/login?verify=1");

  let required = false;
  try {
    required = !(await apiRequest<{ completed: boolean }>("/api/v1/onboarding"))
      .completed;
  } catch {
    /* Data errors remain local to each page. */
  }

  if (required) return <OnboardingGate required />;

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <main id="main-content" className="app-main">
        {children}
      </main>
      <BottomNavigation />
    </div>
  );
}
