import { AuthFlow } from "@/components/auth/auth-flow";
export const metadata = { title: "Account" };
export default function AccountPage() {
  return (
    <section className="mx-auto max-w-md">
      <h1 className="text-3xl">Your account</h1>
      <p className="mt-3 text-slate-400">
        Attach a verified phone number to this account. Your identity, cash and
        holdings stay the same. An existing account is never merged
        automatically.
      </p>
      <AuthFlow mode="attach" />
    </section>
  );
}
