"use client";

import { useShallow } from "zustand/react/shallow";
import { launcherActions, useLauncherStore, type LaunchSession } from "@/lib/launcher-store";
import { isLaunchInProgress } from "@/lib/launch-session-ui";
import { getLauncherApi, isDesktopLauncher } from "@/lib/electron-api";
import { resolveLaunchDesktopWindow } from "@craftlauncher/shared";
import { LaunchPanelComposite } from "./launch-hub/LaunchUiParts";

/** UI de la ventana de escritorio de progreso (minimalista, completa). */
export function LaunchProgressWindowView({
  session,
  onDismiss,
}: {
  session: LaunchSession;
  onDismiss: () => void;
}) {
  return (
    <div className={`lw-body lw-body-${session.phase}`}>
      <LaunchPanelComposite
        session={session}
        onDismiss={onDismiss}
        showHint={isLaunchInProgress(session.phase)}
      />
    </div>
  );
}

/** Modal solo en navegador (sin ventana Electron). */
export function LaunchProgressPanel() {
  if (isDesktopLauncher()) return null;

  const session = useLauncherStore((s) => s.launchSession);

  if (!session.visible) return null;

  return (
    <div className="lp-overlay" role="dialog" aria-modal="true">
      <div className="lp-card-browser">
        <LaunchProgressWindowView session={session} onDismiss={launcherActions.hideLaunchPanel} />
      </div>
    </div>
  );
}

/** Pill en la barra para reabrir la ventana de progreso. */
export function LaunchProgressChip() {
  const session = useLauncherStore(
    useShallow((s) => ({
      visible: s.launchSession.visible,
      phase: s.launchSession.phase,
      percent: s.launchSession.percent,
      logs: s.launchSession.logs,
      structuredLogs: s.launchSession.structuredLogs,
      desktopWindow: resolveLaunchDesktopWindow(s.layout),
    }))
  );

  if (session.visible || session.phase === "idle") return null;

  const hasLog = session.logs.length > 0 || session.structuredLogs.length > 0;
  const busy = isLaunchInProgress(session.phase);

  if (!busy && session.phase !== "closed" && session.phase !== "error" && session.phase !== "running") {
    return null;
  }

  const pct = session.percent != null ? `${Math.round(session.percent)}%` : null;
  let label = "Ver progreso";
  if (busy && pct) label = `${pct} · progreso`;
  else if (session.phase === "closed") label = hasLog ? "Ver log" : "Cerrado";
  else if (session.phase === "running") label = "En juego";
  else if (session.phase === "error") label = "Ver error";

  return (
    <button
      type="button"
      className={`lp-chip${session.phase === "closed" ? " lp-chip-muted" : ""}`}
      onClick={() => {
        if (isDesktopLauncher() && session.desktopWindow) {
          void getLauncherApi()?.openLaunchProgress?.();
        }
        launcherActions.showLaunchPanel();
      }}
      title={
        session.desktopWindow
          ? "Abrir ventana de progreso"
          : "Progreso en el Hub (ventana separada desactivada)"
      }
    >
      {busy && <span className="lp-chip-pulse" />}
      {label}
    </button>
  );
}
