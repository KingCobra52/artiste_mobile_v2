import Link from "next/link";
import { logout } from "@/actions/auth";

export function AppHeader() {
  return (
    <header className="app-header sticky top-0 z-20 backdrop-blur-xl">
      <div className="mx-auto flex min-h-20 flex-wrap gap-2 py-3 max-w-5xl items-center justify-between px-5">
        <div>
          <Link
            href="/market"
            className="text-2xl font-bold tracking-tight text-white"
          >
            artiste
          </Link>
          <p className="text-xs text-slate-500">
            Music discovery. Paper trading.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Link
            className="touch rounded-xl px-2 text-xs text-sky-200"
            href="/onboarding?replay=1"
          >
            How Artiste works
          </Link>
          <Link
            className="touch rounded-xl px-2 text-xs text-sky-200"
            href="/account"
          >
            Account
          </Link>
          <form action={logout}>
            <button className="min-h-11 rounded-xl px-3 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
