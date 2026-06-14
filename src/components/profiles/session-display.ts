import type { SessionClientKind } from "@/lib/launcher-auth/types";

export const SESSION_PLATFORM_LABELS: Record<SessionClientKind, string> = {
  launcher: "Launcher",
  portal: "Player Portal (Web)",
  tester: "Modo testeo",
};

export function formatSessionIp(ip?: string): string {
  if (!ip?.trim()) return "—";
  const v = ip.trim();
  if (v === "::1" || v === "127.0.0.1") return "Localhost (este equipo)";
  return v;
}

export type SessionPresenceHint = {
  deviceId: string;
  statusLabel: string;
  secondsSinceHeartbeat: number;
  os?: string;
  launcherVersion?: string;
  ip?: string;
  city?: string;
  country?: string;
};

export function describeSessionActivity(
  session: {
    revoked: boolean;
    expiresAt: string;
    lastSeenAt: string;
    createdAt: string;
    clientKind?: SessionClientKind;
    lastClientKind?: SessionClientKind;
    deviceId: string;
  },
  liveDevices?: SessionPresenceHint[]
) {
  const active = !session.revoked && Date.parse(session.expiresAt) > Date.now();
  const platform: SessionClientKind = session.lastClientKind ?? session.clientKind ?? "launcher";
  const live = liveDevices?.find((d) => d.deviceId === session.deviceId);
  const launcherLive = Boolean(live && live.secondsSinceHeartbeat <= 90);
  const portalLive =
    active &&
    !launcherLive &&
    platform === "portal" &&
    Date.now() - Date.parse(session.lastSeenAt) <= 5 * 60 * 1000;

  return {
    active,
    platform,
    platformLabel: SESSION_PLATFORM_LABELS[platform],
    originLabel: session.clientKind ? SESSION_PLATFORM_LABELS[session.clientKind] : "Sin registro",
    isLiveNow: launcherLive || portalLive,
    liveLabel: launcherLive ? live!.statusLabel : portalLive ? "Portal web en uso" : undefined,
    liveDevice: live,
  };
}
