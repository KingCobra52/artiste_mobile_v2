import { redirect } from "next/navigation";
import { ConfigurationNotice } from "@/components/ui/configuration-notice";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!getSupabaseConfig().configured) return <ConfigurationNotice />;

  const supabase = await createClient();
  const { data, error } = await supabase!.auth.getClaims();
  redirect(!error && data?.claims ? "/market" : "/login");
}
