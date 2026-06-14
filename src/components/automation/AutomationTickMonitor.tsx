"use client";

import { useEffect } from "react";

/** Ejecuta cron y jobs programados mientras el panel admin está abierto. */
export function AutomationTickMonitor() {
  useEffect(() => {
    const tick = () => {
      void fetch("/api/automation?scope=tick", { credentials: "include", cache: "no-store" }).catch(() => {});
    };
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return null;
}
