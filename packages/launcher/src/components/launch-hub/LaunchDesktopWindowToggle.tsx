"use client";

import { launcherActions, useLauncherStore } from "@/lib/launcher-store";
import { resolveLaunchDesktopWindow } from "@craftlauncher/shared";

export function LaunchDesktopWindowToggle({ label }: { label?: string }) {
  const enabled = useLauncherStore((s) => resolveLaunchDesktopWindow(s.layout));

  return (
    <label className="lh-desktop-toggle">
      <span className="lh-desktop-toggle-label">{label || "Ventana descarga separada"}</span>
      <span className="lh-desktop-toggle-track" data-on={enabled ? "1" : "0"}>
        <input
          type="checkbox"
          className="lh-desktop-toggle-input"
          checked={enabled}
          onChange={(e) => launcherActions.setLayoutUi({ launchDesktopWindow: e.target.checked })}
        />
        <span className="lh-desktop-toggle-thumb" aria-hidden />
      </span>
      <span className="lh-desktop-toggle-state">{enabled ? "ON" : "OFF"}</span>
    </label>
  );
}
