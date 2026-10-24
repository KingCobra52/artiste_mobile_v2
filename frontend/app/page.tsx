import { redirect } from "next/navigation";
import { ConfigurationNotice } from "@/components/ui/configuration-notice";
import { getSupabaseConfig } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!getSupabaseConfig().configured) return <ConfigurationNotice />;

  redirect("/onboarding");
}
