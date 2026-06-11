"use client";

import { useEffect, useState } from "react";

export function useTesterModeEnabled(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/launcher-auth/access-settings", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { testerModeEnabled?: boolean };
        if (!cancelled) setEnabled(data.testerModeEnabled === true);
      } catch {
        if (!cancelled) setEnabled(false);
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return enabled;
}
