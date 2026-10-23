import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-5 py-12">
      <section className="max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lime-200">Not found</p>
        <h1 className="mt-2 text-3xl font-bold text-white">Artist not found</h1>
        <p className="mt-3 text-slate-400">That artist is not in the current market.</p>
        <Link href="/market" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-lime-300 px-5 font-semibold text-slate-950">Back to Market</Link>
      </section>
    </main>
  );
}
