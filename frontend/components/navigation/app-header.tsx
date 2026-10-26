import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { Icon } from "@/components/ui/icon";
import { BottomNavigation } from "./bottom-navigation";
export function AppHeader() {
  return (
    <header className="app-header">
      <div className="header-inner">
        <Wordmark />
        <BottomNavigation desktop />
        <div className="header-utilities">
          <Link href="/onboarding?replay=1" aria-label="How Artiste works">
            <Icon name="help" />
            <span className="utility-label">How Artiste works</span>
          </Link>
          <Link href="/account" aria-label="Account">
            <Icon name="account" />
            <span className="utility-label">Account</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
