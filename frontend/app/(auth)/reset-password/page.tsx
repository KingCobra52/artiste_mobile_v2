import { AuthPage } from "@/components/auth/auth-page";
import { AuthFlow } from "@/components/auth/auth-flow";
export const dynamic = "force-dynamic";
export const metadata = { title: "Set password" };
export default function ResetPage() {
  return (
    <AuthPage
      title="Set a new password"
      description="Use the verified email recovery session to choose a new password."
    >
      <AuthFlow mode="reset" />
    </AuthPage>
  );
}
