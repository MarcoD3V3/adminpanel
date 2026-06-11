import type { LivePresenceRecord } from "@/lib/live-ops/store";
import type { AdminProfileUser, AdminSessionPublic } from "./service";
import type { AuditLogEntry } from "./types";

export type LiveDeviceIntel = {
  deviceId: string;
  sessionId: string;
  ip: string;
  country: string;
  countryCode: string;
  city: string;
  os: string;
  launcherVersion: string;
  minecraftVersion?: string;
  status: LivePresenceRecord["status"];
  statusLabel: string;
  ramUsage: number;
  cpuUsage: number;
  health: LivePresenceRecord["health"];
  connectedAt: string;
  lastSeenAt: string;
  secondsSinceHeartbeat: number;
  uptimeMinutes: number;
};

export type UserModerationIntel = {
  userId: string;
  username: string;
  displayName: string;
  tier: "free" | "premium";
  accountRevoked: boolean;
  launcherOpen: boolean;
  launcherStatus?: LivePresenceRecord["status"];
  launcherStatusLabel?: string;
  liveDeviceCount: number;
  liveDevices: LiveDeviceIntel[];
  activeSessionCount: number;
  totalSessionCount: number;
  knownIps: string[];
  uniqueIpCount: number;
  uniqueDeviceCount: number;
  primaryIp?: string;
  primaryCountry?: string;
  primaryCity?: string;
  fingerprintPrefixes: string[];
  failedLogins24h: number;
  lastFailedLoginAt?: string;
  lastFailedLoginIp?: string;
  successfulLogins7d: number;
  auditEvents7d: number;
  riskLevel: "low" | "medium" | "high";
  riskSignals: string[];
  lastSeenAt?: string;
  sessionExpiresSoon: boolean;
};

const STATUS_LABELS: Record<LivePresenceRecord["status"], string> = {
  online: "Launcher abierto",
  playing: "Jugando Minecraft",
  launching: "Iniciando juego",
  updating: "Actualizando",
  idle: "Inactivo en launcher",
};

function isSessionActive(expiresAt: string, revoked: boolean): boolean {
  return !revoked && Date.parse(expiresAt) > Date.now();
}

function withinMs(iso: string, ms: number): boolean {
  return Date.now() - Date.parse(iso) <= ms;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function buildUserModerationIntel(
  user: AdminProfileUser,
  sessions: AdminSessionPublic[],
  presence: LivePresenceRecord[],
  auditLog: AuditLogEntry[],
  fingerprintBySessionId: Map<string, string>
): UserModerationIntel {
  const userSessions = sessions.filter((s) => s.userId === user.id);
  const activeSessions = userSessions.filter((s) => isSessionActive(s.expiresAt, s.revoked));
  const userPresence = presence.filter((p) => p.userId === user.id || p.username === user.username);
  const now = Date.now();

  const liveDevices: LiveDeviceIntel[] = userPresence.map((p) => {
    const seenMs = now - Date.parse(p.lastSeenAt);
    const uptimeMinutes = Math.max(0, Math.floor((now - Date.parse(p.connectedAt)) / 60_000));
    return {
      deviceId: p.deviceId,
      sessionId: p.id,
      ip: p.ip,
      country: p.country,
      countryCode: p.countryCode,
      city: p.city,
      os: p.os,
      launcherVersion: p.launcherVersion,
      minecraftVersion: p.minecraftVersion,
      status: p.status,
      statusLabel: STATUS_LABELS[p.status],
      ramUsage: p.ramUsage,
      cpuUsage: p.cpuUsage,
      health: p.health,
      connectedAt: p.connectedAt,
      lastSeenAt: p.lastSeenAt,
      secondsSinceHeartbeat: Math.floor(seenMs / 1000),
      uptimeMinutes,
    };
  });

  const knownIps = uniqueStrings([
    ...userSessions.map((s) => s.ipHint ?? ""),
    ...userPresence.map((p) => p.ip),
  ]);

  const userAudit = auditLog.filter(
    (e) => e.meta === user.username || e.meta === user.id || e.meta?.includes(user.username)
  );
  const failed24h = userAudit.filter(
    (e) => e.action === "user_login_failed" && withinMs(e.at, 24 * 60 * 60 * 1000)
  );
  const lastFail = failed24h[0];
  const success7d = userAudit.filter(
    (e) => e.action === "user_login_success" && withinMs(e.at, 7 * 24 * 60 * 60 * 1000)
  ).length;
  const audit7d = userAudit.filter((e) => withinMs(e.at, 7 * 24 * 60 * 60 * 1000)).length;

  const fingerprintPrefixes = uniqueStrings(
    activeSessions.map((s) => fingerprintBySessionId.get(s.id) ?? "").map((h) => h.slice(0, 12))
  );

  const primaryLive = liveDevices[0];
  const launcherOpen = liveDevices.length > 0;
  const riskSignals: string[] = [];

  if (user.revoked && activeSessions.length > 0) {
    riskSignals.push("Cuenta revocada con sesión aún activa");
  }
  if (failed24h.length >= 3) {
    riskSignals.push(`${failed24h.length} intentos de login fallidos en 24 h`);
  }
  if (knownIps.length >= 3) {
    riskSignals.push(`${knownIps.length} IPs distintas en historial`);
  }
  if (liveDevices.some((d) => d.health === "critical")) {
    riskSignals.push("Dispositivo con salud crítica (RAM/CPU)");
  }
  if (activeSessions.length >= 3) {
    riskSignals.push("Múltiples sesiones activas simultáneas");
  }
  if (launcherOpen && liveDevices.some((d) => d.secondsSinceHeartbeat > 30)) {
    riskSignals.push("Heartbeat irregular (>30 s)");
  }

  const riskLevel: UserModerationIntel["riskLevel"] =
    riskSignals.length >= 2 || failed24h.length >= 5
      ? "high"
      : riskSignals.length >= 1
        ? "medium"
        : "low";

  const sessionExpiresSoon = activeSessions.some(
    (s) => Date.parse(s.expiresAt) - now < 7 * 24 * 60 * 60 * 1000
  );

  const lastSeenCandidates = [
    ...liveDevices.map((d) => d.lastSeenAt),
    ...activeSessions.map((s) => s.lastSeenAt),
  ].sort((a, b) => Date.parse(b) - Date.parse(a));

  return {
    userId: user.id,
    username: user.username,
    displayName: user.displayName ?? user.username,
    tier: user.tier ?? "free",
    accountRevoked: user.revoked,
    launcherOpen,
    launcherStatus: primaryLive?.status,
    launcherStatusLabel: primaryLive?.statusLabel,
    liveDeviceCount: liveDevices.length,
    liveDevices,
    activeSessionCount: activeSessions.length,
    totalSessionCount: userSessions.length,
    knownIps,
    uniqueIpCount: knownIps.length,
    uniqueDeviceCount: uniqueStrings(userSessions.map((s) => s.deviceId)).length,
    primaryIp: primaryLive?.ip ?? activeSessions[0]?.ipHint,
    primaryCountry: primaryLive?.country,
    primaryCity: primaryLive?.city,
    fingerprintPrefixes,
    failedLogins24h: failed24h.length,
    lastFailedLoginAt: lastFail?.at,
    lastFailedLoginIp: lastFail?.ipHint,
    successfulLogins7d: success7d,
    auditEvents7d: audit7d,
    riskLevel,
    riskSignals,
    lastSeenAt: lastSeenCandidates[0],
    sessionExpiresSoon,
  };
}

export function formatModerationReport(intel: UserModerationIntel): string {
  const lines = [
    `=== Informe moderación · @${intel.username} ===`,
    `Estado cuenta: ${intel.accountRevoked ? "REVOCADA" : "ACTIVA"}`,
    `Launcher abierto: ${intel.launcherOpen ? `SÍ — ${intel.launcherStatusLabel}` : "NO"}`,
    `IP principal: ${intel.primaryIp ?? "—"}`,
    `Ubicación: ${intel.primaryCity ?? "—"}, ${intel.primaryCountry ?? "—"}`,
    `Sesiones activas: ${intel.activeSessionCount}`,
    `IPs conocidas (${intel.uniqueIpCount}): ${intel.knownIps.join(", ") || "—"}`,
    `Dispositivos únicos: ${intel.uniqueDeviceCount}`,
    `Huellas dispositivo: ${intel.fingerprintPrefixes.join(", ") || "—"}`,
    `Logins fallidos 24h: ${intel.failedLogins24h}`,
    `Último fallo: ${intel.lastFailedLoginIp ?? "—"} ${intel.lastFailedLoginAt ?? ""}`,
    `Riesgo: ${intel.riskLevel.toUpperCase()}`,
    ...(intel.riskSignals.length ? [`Alertas: ${intel.riskSignals.join(" · ")}`] : []),
    ...(intel.liveDevices.length
      ? intel.liveDevices.map(
          (d, i) =>
            `Dispositivo ${i + 1}: ${d.deviceId} | ${d.os} | MC ${d.minecraftVersion ?? "—"} | RAM ${d.ramUsage}% CPU ${d.cpuUsage}% | ${d.ip}`
        )
      : []),
  ];
  return lines.join("\n");
}
