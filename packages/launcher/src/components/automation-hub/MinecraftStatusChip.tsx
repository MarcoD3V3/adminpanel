"use client";

import { phaseShortLabel } from "@/lib/launch-session-ui";
import { useLauncherStore } from "@/lib/launcher-store";

export function MinecraftStatusChip({ label }: { label?: string }) {
  const phase = useLauncherStore((s) => s.launchSession.phase);
  const message = useLauncherStore((s) => s.launchSession.message);
  const text =
    phase === "idle" || phase === "closed" ? label || "Listo" : phaseShortLabel(phase) || phase;

  return (
    <div className={`mc-status-chip mc-status-${phase}`} title={message || undefined}>
      <span className="mc-status-dot" aria-hidden />
      <span className="mc-status-text">{text}</span>
    </div>
  );
}
