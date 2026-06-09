"use client";

import { useShallow } from "zustand/react/shallow";
import { launcherActions, useLauncherStore } from "@/lib/launcher-store";
import { isLaunchInProgress, isLaunchUiActive } from "@/lib/launch-session-ui";
import {
  LaunchDetailText,
  LaunchDismissButton,
  LaunchErrorBlock,
  LaunchHintText,
  LaunchLogPanel,
  LaunchOkHint,
  LaunchPanelComposite,
  LaunchPhaseLabel,
  LaunchProgressBar,
  LaunchStructuredLog,
  LaunchVersionTitle,
  type LaunchUiSession,
} from "./LaunchUiParts";
import { LaunchDesktopWindowToggle } from "./LaunchDesktopWindowToggle";

function useBoundLaunchSession(): LaunchUiSession {
  return useLauncherStore(
    useShallow((s) => ({
      phase: s.launchSession.phase,
      versionLabel: s.launchSession.versionLabel,
      message: s.launchSession.message,
      percent: s.launchSession.percent,
      logs: s.launchSession.logs,
      structuredLogs: s.launchSession.structuredLogs,
      error: s.launchSession.error,
    }))
  );
}

function useLaunchUiSession(): LaunchUiSession | null {
  const session = useBoundLaunchSession();
  const status = useLauncherStore((s) => s.status);
  if (!isLaunchUiActive(session.phase, status)) return null;
  return session;
}

export function LaunchVersionTitleHub() {
  const session = useLaunchUiSession();
  if (!session) return null;
  return <LaunchVersionTitle session={session} />;
}

export function LaunchPhaseLabelHub() {
  const session = useLaunchUiSession();
  if (!session) return null;
  return <LaunchPhaseLabel session={session} />;
}

export function LaunchDetailTextHub() {
  const session = useLaunchUiSession();
  if (!session) return null;
  return <LaunchDetailText session={session} />;
}

export function LaunchProgressBarHub() {
  const session = useBoundLaunchSession();
  const status = useLauncherStore((s) => s.status);
  if (!isLaunchUiActive(session.phase, status)) return null;
  return <LaunchProgressBar session={session} forceShow />;
}

export function LaunchLogPanelHub({ defaultOpen }: { defaultOpen?: boolean }) {
  const session = useLaunchUiSession();
  if (!session) return null;
  return <LaunchLogPanel session={session} defaultOpen={defaultOpen} />;
}

export function LaunchStructuredLogHub({ defaultOpen }: { defaultOpen?: boolean }) {
  const session = useLaunchUiSession();
  if (!session) return null;
  return <LaunchStructuredLog session={session} defaultOpen={defaultOpen} />;
}

export function LaunchErrorBlockHub() {
  const session = useLaunchUiSession();
  if (!session) return null;
  return <LaunchErrorBlock session={session} />;
}

export function LaunchOkHintHub() {
  const session = useLaunchUiSession();
  if (!session) return null;
  return <LaunchOkHint session={session} />;
}

export function LaunchDesktopWindowToggleHub({ label }: { label?: string }) {
  return <LaunchDesktopWindowToggle label={label} />;
}

export function LaunchHintTextHub({ label }: { label?: string }) {
  const session = useLaunchUiSession();
  if (!session || !isLaunchInProgress(session.phase)) return null;
  return <LaunchHintText>{label || "Ocultar no cancela la descarga"}</LaunchHintText>;
}

export function LaunchDismissButtonHub({ label }: { label?: string }) {
  const session = useLaunchUiSession();
  if (!session) return null;
  return (
    <LaunchDismissButton
      session={session}
      label={label}
      onClick={() => launcherActions.hideLaunchPanel()}
    />
  );
}

export function LaunchPanelHub() {
  const session = useLaunchUiSession();
  if (!session) return null;
  return (
    <LaunchPanelComposite session={session} onDismiss={() => launcherActions.hideLaunchPanel()} />
  );
}
