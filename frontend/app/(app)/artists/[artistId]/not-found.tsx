import Link from "next/link";
import { Icon } from "@/components/ui/icon";
export default function ArtistNotFound() {
  return (
    <section className="state-panel">
      <Icon name="record" />
      <p className="eyebrow">Not found</p>
      <h1 className="section-title mt-3">Artist not found</h1>
      <p className="body-copy mt-3">
        This artist is not in the current catalog. Explore the Market to find
        supported artists.
      </p>
      <Link href="/market" className="action-secondary mt-5">
        Return to Market
      </Link>
    </section>
  );
}
