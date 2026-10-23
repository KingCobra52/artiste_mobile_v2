import { logout } from "@/actions/auth";

export function AppHeader() {
  return (
    <header className="app-header sticky top-0 z-20 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-5xl items-center justify-between px-5">
        <div>
          <p className="text-2xl font-bold tracking-tight text-white">artiste</p>
          <p className="text-xs text-slate-500">Music discovery. Paper trading.</p>
        </div>
        <form action={logout}>
          <button className="min-h-11 rounded-xl px-3 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
