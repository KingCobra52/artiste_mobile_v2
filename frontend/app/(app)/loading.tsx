import { LoadingState } from "@/components/ui/states";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8">
      <LoadingState label="Loading page" />
    </div>
  );
}
