import { logout } from "@/actions/auth";
export const metadata = { title: "Account" };
export default function AccountPage() {
  return (
    <div className="mx-auto max-w-xl">
      <p className="eyebrow">Personal details</p>
      <h1 className="portfolio-title">Your account</h1>
      <form action={logout} className="mt-6 border-t border-line pt-5">
        <button className="action-secondary">Sign out</button>
      </form>
    </div>
  );
}
