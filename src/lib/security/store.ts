import { randomBytes } from "node:crypto";
import { getSqliteDb } from "@/lib/db/sqlite";
import type { SecurityAlert, SecurityRule } from "@/types/features";
import { defaultSecurityRules } from "./catalog";

type AlertRow = {
  id: string;
  detection_type: string;
  source: string;
  severity: string;
  username: string;
  user_id: string;
  device_id: string | null;
  ip: string | null;
  detail: string;
  metadata: string | null;
  resolved: number;
  detected_at: string;
};

function rowToAlert(row: AlertRow): SecurityAlert {
  return {
    id: row.id,
    type: row.detection_type as SecurityAlert["type"],
    source: row.source as SecurityAlert["source"],
    severity: row.severity as SecurityAlert["severity"],
    username: row.username,
    userId: row.user_id,
    deviceId: row.device_id ?? undefined,
    ip: row.ip ?? undefined,
    detail: row.detail,
    metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : undefined,
    resolved: row.resolved === 1,
    detectedAt: row.detected_at,
  };
}

export function ensureSecurityRulesSeeded(): void {
  const db = getSqliteDb();
  const count = db.prepare("SELECT COUNT(*) AS c FROM security_rules").get() as { c: number };
  if (count.c > 0) return;

  const insert = db.prepare(`
    INSERT INTO security_rules (id, detection_type, name, description, enabled, action, source)
    VALUES (@id, @detection_type, @name, @description, @enabled, @action, @source)
  `);

  const tx = db.transaction(() => {
    for (const rule of defaultSecurityRules()) {
      insert.run({
        id: rule.id,
        detection_type: rule.detectionType,
        name: rule.name,
        description: rule.description,
        enabled: rule.enabled ? 1 : 0,
        action: rule.action,
        source: rule.source,
      });
    }
  });
  tx();
}

export function listSecurityRules(): SecurityRule[] {
  ensureSecurityRulesSeeded();
  const rows = getSqliteDb()
    .prepare("SELECT * FROM security_rules ORDER BY id")
    .all() as Array<{
    id: string;
    detection_type: string;
    name: string;
    description: string;
    enabled: number;
    action: string;
    source: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    detectionType: r.detection_type as SecurityRule["detectionType"],
    name: r.name,
    description: r.description,
    enabled: r.enabled === 1,
    action: r.action as SecurityRule["action"],
    source: r.source as SecurityRule["source"],
  }));
}

export function setRuleEnabled(ruleId: string, enabled: boolean): SecurityRule | null {
  const db = getSqliteDb();
  db.prepare("UPDATE security_rules SET enabled = ? WHERE id = ?").run(enabled ? 1 : 0, ruleId);
  return listSecurityRules().find((r) => r.id === ruleId) ?? null;
}

export function isDetectionEnabled(type: SecurityAlert["type"]): boolean {
  ensureSecurityRulesSeeded();
  const row = getSqliteDb()
    .prepare("SELECT enabled FROM security_rules WHERE detection_type = ?")
    .get(type) as { enabled: number } | undefined;
  return row ? row.enabled === 1 : true;
}

export function insertSecurityAlert(alert: Omit<SecurityAlert, "id" | "detectedAt" | "resolved">): SecurityAlert {
  const db = getSqliteDb();
  const id = `sec_${randomBytes(6).toString("hex")}`;
  const detectedAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO security_alerts (
      id, detection_type, source, severity, username, user_id, device_id, ip, detail, metadata, resolved, detected_at
    ) VALUES (
      @id, @detection_type, @source, @severity, @username, @user_id, @device_id, @ip, @detail, @metadata, 0, @detected_at
    )
  `).run({
    id,
    detection_type: alert.type,
    source: alert.source,
    severity: alert.severity,
    username: alert.username,
    user_id: alert.userId,
    device_id: alert.deviceId ?? null,
    ip: alert.ip ?? null,
    detail: alert.detail,
    metadata: alert.metadata ? JSON.stringify(alert.metadata) : null,
    detected_at: detectedAt,
  });

  return { ...alert, id, detectedAt, resolved: false };
}

export function hasRecentDuplicate(
  type: SecurityAlert["type"],
  fingerprint: string,
  windowMs = 5 * 60 * 1000
): boolean {
  const since = new Date(Date.now() - windowMs).toISOString();
  const row = getSqliteDb()
    .prepare(
      `SELECT COUNT(*) AS c FROM security_alerts
       WHERE detection_type = ? AND detail LIKE ? AND detected_at >= ? AND resolved = 0`
    )
    .get(type, `%${fingerprint}%`, since) as { c: number };
  return row.c > 0;
}

export function listSecurityAlerts(limit = 200): SecurityAlert[] {
  ensureSecurityRulesSeeded();
  const rows = getSqliteDb()
    .prepare("SELECT * FROM security_alerts ORDER BY datetime(detected_at) DESC LIMIT ?")
    .all(limit) as AlertRow[];
  return rows.map(rowToAlert);
}

export function resolveSecurityAlert(id: string): SecurityAlert | null {
  getSqliteDb().prepare("UPDATE security_alerts SET resolved = 1 WHERE id = ?").run(id);
  const row = getSqliteDb().prepare("SELECT * FROM security_alerts WHERE id = ?").get(id) as AlertRow | undefined;
  return row ? rowToAlert(row) : null;
}

export function bumpClientHit(name: string, type: SecurityAlert["type"], severity: SecurityAlert["severity"]): void {
  const db = getSqliteDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO security_client_hits (name, detection_type, severity, hit_count, last_seen_at)
    VALUES (@name, @type, @severity, 1, @now)
    ON CONFLICT(name) DO UPDATE SET
      hit_count = hit_count + 1,
      last_seen_at = @now,
      detection_type = @type,
      severity = @severity
  `).run({ name, type, severity, now });
}

export type ClientHit = {
  name: string;
  detectionType: SecurityAlert["type"];
  severity: SecurityAlert["severity"];
  hitCount: number;
  lastSeenAt: string;
};

export function listClientHits(): ClientHit[] {
  const rows = getSqliteDb()
    .prepare("SELECT * FROM security_client_hits ORDER BY hit_count DESC LIMIT 50")
    .all() as Array<{
    name: string;
    detection_type: string;
    severity: string;
    hit_count: number;
    last_seen_at: string;
  }>;

  return rows.map((r) => ({
    name: r.name,
    detectionType: r.detection_type as ClientHit["detectionType"],
    severity: r.severity as ClientHit["severity"],
    hitCount: r.hit_count,
    lastSeenAt: r.last_seen_at,
  }));
}

export function countOpenAlerts(): { total: number; critical: number } {
  const db = getSqliteDb();
  const total = db.prepare("SELECT COUNT(*) AS c FROM security_alerts WHERE resolved = 0").get() as { c: number };
  const critical = db
    .prepare("SELECT COUNT(*) AS c FROM security_alerts WHERE resolved = 0 AND severity = 'critical'")
    .get() as { c: number };
  return { total: total.c, critical: critical.c };
}

export function countBansToday(): number {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const row = getSqliteDb()
    .prepare(
      `SELECT COUNT(*) AS c FROM security_alerts
       WHERE detected_at >= ? AND (detection_type LIKE 'launcher_%' AND severity IN ('critical', 'high'))`
    )
    .get(start.toISOString()) as { c: number };
  return row.c;
}
