"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { LaunchSession } from "@/lib/launcher-store";
import {
  filterStaleJavaLogs,
  formatLaunchError,
  isLaunchInProgress,
  phaseShortLabel,
} from "@/lib/launch-session-ui";

export type LaunchUiSession = Pick<
  LaunchSession,
  "phase" | "versionLabel" | "message" | "percent" | "logs" | "structuredLogs" | "error"
>;

export const MOCK_LAUNCH_SESSION: LaunchUiSession = {
  phase: "downloading",
  versionLabel: "danilo · 1.16.5 Forge",
  message: "assets: 2293/2615",
  percent: 42,
  logs: ["Carpeta de juego", "Java 8 en caché", "Java listo", "Librerías del juego"],
  structuredLogs: [],
  error: null,
};

function useLogLines(session: LaunchUiSession, max: number) {
  return useMemo(() => {
    const structured = filterStaleJavaLogs(session.structuredLogs ?? [], session.phase);
    if (structured.length) {
      return structured.slice(-max).map((s) => s.message);
    }
    return (session.logs ?? []).slice(-max);
  }, [session.structuredLogs, session.logs, max]);
}

export function LaunchVersionTitle({
  session,
  fallback = "Minecraft",
}: {
  session: LaunchUiSession;
  fallback?: string;
}) {
  return <p className="lh-version">{session.versionLabel || fallback}</p>;
}

export function LaunchPhaseLabel({ session }: { session: LaunchUiSession }) {
  const busy = isLaunchInProgress(session.phase);
  const pct =
    session.percent != null ? `${Math.round(Math.min(100, Math.max(0, session.percent)))}%` : null;
  return (
    <div className="lh-phase-row">
      <span className={`lh-phase lh-phase-${session.phase}`}>{phaseShortLabel(session.phase)}</span>
      {busy && pct && <span className="lh-pct">{pct}</span>}
    </div>
  );
}

const RUNNING_OK_MSG = /minecraft en ejecución/i;

export function LaunchDetailText({ session }: { session: LaunchUiSession }) {
  const msg = session.message?.trim() ?? "";
  if (!msg) return null;
  if (session.phase === "running") {
    if (/^error de lanzamiento$/i.test(msg)) return null;
    if (RUNNING_OK_MSG.test(msg)) return null;
  }
  return <p className="lh-detail">{msg}</p>;
}

export function LaunchProgressBar({
  session,
  forceShow,
}: {
  session: LaunchUiSession;
  /** Mientras status=launching aunque la fase siga en idle un instante. */
  forceShow?: boolean;
}) {
  const busy =
    isLaunchInProgress(session.phase) || session.phase === "running" || Boolean(forceShow);
  if (!busy && session.phase !== "error") return null;
  const pct = session.percent != null ? Math.min(100, Math.max(0, session.percent)) : null;
  const indeterminate = busy && pct == null;
  return (
    <div className="lh-progress" aria-label="Progreso" role="progressbar" aria-valuenow={pct ?? undefined}>
      <div
        className={`lh-progress-fill${indeterminate ? " lh-progress-indeterminate" : ""}`}
        style={indeterminate ? undefined : { width: pct != null ? `${pct}%` : "12%" }}
      />
    </div>
  );
}

export function LaunchErrorBlock({ session }: { session: LaunchUiSession }) {
  if (session.phase !== "error" && !session.error) return null;
  return (
    <p className="lh-error" role="alert">
      {formatLaunchError(session.error ?? session.message)}
    </p>
  );
}

export function LaunchOkHint({ session }: { session: LaunchUiSession }) {
  if (session.phase !== "running") return null;
  return <p className="lh-ok">Minecraft en ejecución — el registro sigue actualizándose abajo.</p>;
}

export function LaunchStructuredLog({
  session,
  defaultOpen = false,
  maxLines = 14,
  title = "Registro",
}: {
  session: LaunchUiSession;
  defaultOpen?: boolean;
  maxLines?: number;
  title?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const entries = useMemo(() => {
    const structured = filterStaleJavaLogs(session.structuredLogs ?? [], session.phase);
    if (structured.length) return structured.slice(-maxLines);
    return (session.logs ?? []).slice(-maxLines).map((message) => ({
      message,
      level: "step" as const,
    }));
  }, [session.structuredLogs, session.logs, session.phase, maxLines]);

  if (!entries.length) return null;

  return (
    <div className="lh-log-block">
      <button
        type="button"
        className="lh-log-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>{title}</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      <ul className={`lh-log lh-log-structured${open ? " lh-log-open" : ""}`}>
        {entries.map((entry, i) => (
          <li key={`${i}-${entry.message.slice(0, 24)}`} className={`lh-log-${entry.level}`}>
            <span className="lh-log-msg">{entry.message}</span>
            {entry.detail ? <span className="lh-log-detail">{entry.detail}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LaunchLogPanel({
  session,
  defaultOpen = false,
  maxLines = 12,
}: {
  session: LaunchUiSession;
  defaultOpen?: boolean;
  maxLines?: number;
}) {
  return (
    <LaunchStructuredLog session={session} defaultOpen={defaultOpen} maxLines={maxLines} title="Registro" />
  );
}

export function LaunchHintText({
  children = "Ocultar solo la vista — Minecraft sigue descargando o en juego",
}: {
  children?: string;
}) {
  return <p className="lh-hint">{children}</p>;
}

export function LaunchDismissButton({
  session,
  onClick,
  label,
}: {
  session: LaunchUiSession;
  onClick: () => void;
  label?: string;
}) {
  const busy = isLaunchInProgress(session.phase);
  const isError = session.phase === "error" || Boolean(session.error);
  const text =
    label ??
    (isError ? "Entendido" : busy ? "Ocultar" : session.phase === "running" ? "Cerrar" : "Listo");

  return (
    <button type="button" className="lh-dismiss" onClick={onClick}>
      {text}
    </button>
  );
}

/** Panel completo de descarga/lanzamiento (composable). */
export function LaunchPanelComposite({
  session,
  onDismiss,
  showHint = true,
}: {
  session: LaunchUiSession;
  onDismiss: () => void;
  showHint?: boolean;
}) {
  const busy = isLaunchInProgress(session.phase);
  return (
    <div className={`lh-panel lh-panel-${session.phase}`}>
      <div className="lh-panel-main">
        <LaunchVersionTitle session={session} />
        <LaunchPhaseLabel session={session} />
        <LaunchDetailText session={session} />
        <LaunchProgressBar session={session} />
        <LaunchErrorBlock session={session} />
        <LaunchOkHint session={session} />
      </div>
      <LaunchLogPanel
        session={session}
        defaultOpen={session.phase === "running" || session.phase === "downloading"}
        maxLines={session.phase === "running" ? 40 : 14}
      />
      <footer className="lh-panel-foot">
        {busy && showHint && <LaunchHintText />}
        <LaunchDismissButton session={session} onClick={onDismiss} />
      </footer>
    </div>
  );
}
