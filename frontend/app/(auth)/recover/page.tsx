import { AuthPage } from "@/components/auth/auth-page";
import { AuthFlow } from "@/components/auth/auth-flow";
export const dynamic = "force-dynamic";
export const metadata = { title: "Recover account" };
export default function RecoverPage() {
  return (
    <AuthPage
      title="Recover your account"
      description="Verify your phone by SMS to set a new password. Existing email accounts can request a recovery link."
    >
      <AuthFlow mode="recover" />
    </AuthPage>
  );
}
