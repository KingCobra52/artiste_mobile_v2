import { AuthFlow } from "@/components/auth/auth-flow";
import { logout } from "@/actions/auth";
export const metadata = { title: "Account" };
export default function AccountPage() {
  return (
    <div className="mx-auto max-w-xl">
      <p className="eyebrow">Personal details</p>
      <h1 className="portfolio-title">Your account</h1>
      <section className="panel mt-6">
        <h2 className="section-title">Connect your phone</h2>
        <p className="body-copy mt-3">
          Attach a verified phone number to your existing account. Your
          identity, virtual cash, and holdings stay with you.
        </p>
        <AuthFlow mode="attach" />
      </section>
      <form action={logout} className="mt-6 border-t border-line pt-5">
        <button className="action-secondary">Sign out</button>
      </form>
    </div>
  );
}
