import Link from "next/link";
import { Icon } from "@/components/ui/icon";
export function Wordmark({ href = "/market" }: { href?: string }) {
  return (
    <Link href={href} className="wordmark" aria-label="Artiste home">
      <Icon name="record" />
      <span>
        artiste<span className="wordmark-period">.</span>
      </span>
    </Link>
  );
}
