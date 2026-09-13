import Link from "next/link";
import { EmptyState } from "@/components/ui/states";

export default function ArtistNotFound() {
  return (
    <div className="pt-12">
      <EmptyState title="Artist not found">This artist is not part of the preview market.</EmptyState>
      <Link href="/market" className="mx-auto mt-5 flex min-h-11 w-fit items-center rounded-xl bg-lime-300 px-5 font-semibold text-slate-950">Return to Market</Link>
    </div>
  );
}
