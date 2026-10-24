"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
export function OnboardingGate({ required }: { required: boolean }) {
  const path = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (required)
      router.replace(
        `/onboarding?next=${encodeURIComponent(path + window.location.search)}`,
      );
  }, [required, path, router]);
  return null;
}
