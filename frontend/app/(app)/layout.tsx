import { redirect } from "next/navigation";
import { AppHeader } from "@/components/navigation/app-header";
import { BottomNavigation } from "@/components/navigation/bottom-navigation";
import { ConfigurationNotice } from "@/components/ui/configuration-notice";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  if (!getSupabaseConfig().configured) return <ConfigurationNotice />;

  const supabase = await createClient();
  const { data, error } = await supabase!.auth.getClaims();
  if (error || !data?.claims) redirect("/login");

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl px-5 pb-28 pt-7">{children}</main>
      <BottomNavigation />
    </div>
  );
}
