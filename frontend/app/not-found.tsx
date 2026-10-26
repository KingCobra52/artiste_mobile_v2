import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-5 py-12">
      <section className="max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
          Not found
        </p>
        <h1 className="mt-2 text-3xl font-bold text-ink">Artist not found</h1>
        <p className="mt-3 text-muted">
          That artist is not in the current market.
        </p>
        <Link href="/market" className="action-secondary mt-6">
          Back to Market
        </Link>
      </section>
    </main>
  );
}
