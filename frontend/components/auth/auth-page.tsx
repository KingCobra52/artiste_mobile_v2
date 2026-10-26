import Link from "next/link";
import { ConfigurationNotice } from "@/components/ui/configuration-notice";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { Wordmark } from "@/components/brand/wordmark";
import { Icon } from "@/components/ui/icon";
export function AuthPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  if (!getSupabaseConfig().configured) return <ConfigurationNotice />;
  return (
    <main className="auth-shell">
      <div>
        <Wordmark href="/" />
      </div>
      <div className="auth-layout">
        <aside className="auth-story">
          <p className="eyebrow">Music discovery. Paper trading.</p>
          <h2 className="display mt-4">Follow what moves you.</h2>
          <p className="body-copy">
            Get to know the artists behind the numbers. Explore the music,
            follow audience momentum, and build a portfolio with virtual shares.
          </p>
          <div className="record-art" aria-hidden="true" />
        </aside>
        <section className="auth-form-panel">
          <p className="eyebrow">Your place in the music</p>
          <h1>{title}</h1>
          <p className="body-copy mt-4">{description}</p>
          {children}
          <footer className="auth-footer">
            <Link href="/onboarding?replay=1" className="text-link text-sm">
              <Icon name="help" />
              How Artiste works
            </Link>
            <p className="small-copy mt-2">
              All cash and shares are virtual. They represent no ownership,
              royalties, or real money.
            </p>
          </footer>
        </section>
      </div>
    </main>
  );
}
