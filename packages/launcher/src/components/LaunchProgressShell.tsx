"use client";

import { useEffect, useState } from "react";
import { Minus, X } from "lucide-react";
import { getLauncherApi } from "@/lib/electron-api";
import type { LaunchSession } from "@/lib/launcher-store";
import { LaunchProgressWindowView } from "./LaunchProgressPanel";

const emptySession = (): LaunchSession => ({
  visible: false,
  phase: "idle",
  versionLabel: "",
  message: "",
  percent: null,
  logs: [],
  structuredLogs: [],
  error: null,
  metrics: {
    startedAt: 0,
    lastPercent: 0,
    lastPercentAt: 0,
    velocityPerMin: 0,
    lanes: {},
    lastMilestone: 0,
  },
  whisper: null,
});

export function LaunchProgressShell() {
  const api = getLauncherApi();
  const [session, setSession] = useState<LaunchSession>(emptySession);

  const closeWindow = () => {
    void api?.close?.();
  };

  useEffect(() => {
    if (!api?.onLaunchSession) return;
    return api.onLaunchSession((next) => {
      if (next) setSession(next as LaunchSession);
    });
  }, [api]);

  return (
    <div className="lw-shell">
      <header className="lw-titlebar">
        <span className="lw-titlebar-label">Descarga / lanzamiento</span>
        <div className="lw-titlebar-actions">
          <button
            type="button"
            className="lw-win-btn"
            aria-label="Minimizar"
            onClick={() => void api?.minimize?.()}
          >
            <Minus size={14} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="lw-win-btn lw-win-btn-close"
            aria-label="Cerrar"
            onClick={closeWindow}
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        </div>
      </header>
      <LaunchProgressWindowView session={session} onDismiss={closeWindow} />
    </div>
  );
}
