import { logout } from "@/actions/auth";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/8 bg-slate-950/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
        <div>
          <p className="text-lg font-bold tracking-tight text-white">artiste</p>
          <p className="text-xs text-slate-500">Virtual music market</p>
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
