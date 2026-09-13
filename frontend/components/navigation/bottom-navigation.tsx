"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/market", label: "Market" },
  { href: "/portfolio", label: "Portfolio" },
] as const;

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary navigation" className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-slate-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <div className="mx-auto grid max-w-3xl grid-cols-2 px-3 py-2">
        {items.map((item) => {
          const active = pathname === item.href || (item.href === "/market" && pathname.startsWith("/artists/"));
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center justify-center rounded-xl text-sm font-semibold transition ${active ? "bg-lime-300/15 text-lime-200" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
