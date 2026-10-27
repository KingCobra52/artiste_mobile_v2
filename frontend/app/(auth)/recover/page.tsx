import { AuthPage } from "@/components/auth/auth-page";
import { AuthFlow } from "@/components/auth/auth-flow";
export const dynamic = "force-dynamic";
export const metadata = { title: "Recover account" };
export default function RecoverPage() {
  return (
    <AuthPage
      title="Recover your account"
      description="Request an email link to set a new password."
    >
      <AuthFlow mode="recover" />
    </AuthPage>
  );
}
