"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Periodically calls router.refresh() so a Server Component page picks up
 * fresh data without the user having to reload. Pauses while the document
 * is hidden so background tabs don't hammer the API for nothing.
 */
export function LiveRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      router.refresh();
    };
    const id = window.setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [router, intervalMs]);

  return null;
}
