import type { SecurityAlert, SecurityDetectionType } from "@/types/features";
import { DETECTION_BY_TYPE } from "./catalog";
import {
  bumpClientHit,
  countOpenAlerts,
  hasRecentDuplicate,
  insertSecurityAlert,
  isDetectionEnabled,
  listClientHits,
  listSecurityAlerts,
  listSecurityRules,
  resolveSecurityAlert,
  setRuleEnabled,
  type ClientHit,
} from "./store";

export type RaiseAlertInput = {
  type: SecurityDetectionType;
  detail: string;
  username?: string;
  userId?: string;
  deviceId?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
  clientName?: string;
};

const adminSessionIps = new Map<string, string>();

export async function raiseSecurityAlert(input: RaiseAlertInput): Promise<SecurityAlert | null> {
  if (!isDetectionEnabled(input.type)) return null;

  const def = DETECTION_BY_TYPE[input.type];
  const fingerprint = input.ip ?? input.deviceId ?? input.username ?? "unknown";
  if (hasRecentDuplicate(input.type, fingerprint)) return null;

  const alert = insertSecurityAlert({
    type: input.type,
    source: def.source,
    severity: def.severity,
    username: input.username ?? (def.source === "admin" ? "Panel Admin" : "Launcher"),
    userId: input.userId ?? "",
    deviceId: input.deviceId,
    ip: input.ip,
    detail: input.detail,
    metadata: input.metadata,
  });

  if (input.clientName) {
    bumpClientHit(input.clientName, input.type, def.severity);
  }

  const eventData = {
    type: input.type,
    detail: input.detail,
    username: alert.username,
    severity: alert.severity,
    ip: input.ip,
    deviceId: input.deviceId,
    ...input.metadata,
  };
  const { emitSystemEvent } = await import("@/lib/system-events");
  emitSystemEvent("security.alert", eventData);
  if (alert.severity === "critical") {
    emitSystemEvent("security.critical", eventData);
  } else if (alert.severity === "high") {
    emitSystemEvent("security.high", eventData);
  }

  return alert;
}

export function trackAdminSessionIp(sessionCookie: string, ip: string): void {
  const prev = adminSessionIps.get(sessionCookie);
  if (prev && prev !== ip) {
    void raiseSecurityAlert({
      type: "admin_session_hijack",
      ip,
      detail: `Sesión admin usada desde IP nueva (${ip}, antes ${prev})`,
      metadata: { previousIp: prev, newIp: ip },
    });
  }
  adminSessionIps.set(sessionCookie, ip);
}

export function getSecurityDashboard() {
  const alerts = listSecurityAlerts();
  const rules = listSecurityRules();
  const clients = listClientHits();
  const open = countOpenAlerts();
  const bansToday = alerts.filter(
    (a) => a.detectedAt >= new Date(new Date().setHours(0, 0, 0, 0)).toISOString() && a.detail.toLowerCase().includes("ban")
  ).length;

  return {
    alerts,
    rules,
    clients,
    overview: {
      openAlerts: open.total,
      criticalAlerts: open.critical,
      bansToday,
      activeRules: rules.filter((r) => r.enabled).length,
    },
  };
}

export async function resolveAlert(id: string) {
  return resolveSecurityAlert(id);
}

export async function toggleRule(ruleId: string, enabled: boolean) {
  return setRuleEnabled(ruleId, enabled);
}

export type { ClientHit };
