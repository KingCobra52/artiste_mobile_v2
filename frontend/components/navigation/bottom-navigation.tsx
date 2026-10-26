"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
const items = [
  { href: "/market", label: "Market", icon: "record" },
  { href: "/portfolio", label: "Portfolio", icon: "portfolio" },
] as const;
export function BottomNavigation({ desktop = false }: { desktop?: boolean }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary navigation"
      className={desktop ? "desktop-nav" : "mobile-nav"}
    >
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.href === "/market" && pathname.startsWith("/artists/"));
        return (
          <Link
            key={item.href}
            href={item.href}
            className="nav-link"
            aria-current={active ? "page" : undefined}
          >
            <Icon name={item.icon} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
