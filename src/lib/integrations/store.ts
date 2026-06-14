import { randomBytes } from "node:crypto";
import { getSqliteDb } from "@/lib/db/sqlite";
import { mockIntegrations } from "@/lib/feature-data";
import type { Integration, IntegrationConfig, IntegrationDelivery } from "@/types/features";

type IntegrationRow = {
  id: string;
  name: string;
  type: string;
  url: string;
  events: string;
  active: number;
  description: string;
  config: string | null;
  success_rate: number;
  total_deliveries: number;
  failed_deliveries: number;
  last_triggered: string | null;
  created_at: string;
  updated_at: string;
};

const MAX_DELIVERIES = 500;

function parseEvents(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseConfig(raw: string | null): IntegrationConfig | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as IntegrationConfig;
  } catch {
    return undefined;
  }
}

function rowToIntegration(row: IntegrationRow): Integration {
  const total = row.total_deliveries;
  const failed = row.failed_deliveries;
  return {
    id: row.id,
    name: row.name,
    type: row.type as Integration["type"],
    url: row.url,
    events: parseEvents(row.events),
    active: row.active === 1,
    description: row.description,
    config: parseConfig(row.config),
    successRate: total > 0 ? Math.round(((total - failed) / total) * 1000) / 10 : row.success_rate,
    totalDeliveries: total,
    failedDeliveries: failed,
    lastTriggered: row.last_triggered ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

let seeded = false;

export function ensureIntegrationsSeeded(): void {
  if (seeded) return;
  const db = getSqliteDb();
  const count = db.prepare("SELECT COUNT(*) AS c FROM integrations").get() as { c: number };
  if (count.c > 0) {
    seeded = true;
    return;
  }

  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO integrations (
      id, name, type, url, events, active, description, config, success_rate,
      total_deliveries, failed_deliveries, last_triggered, created_at, updated_at
    ) VALUES (
      @id, @name, @type, @url, @events, @active, @description, @config, @success_rate,
      0, 0, @last_triggered, @created_at, @updated_at
    )
  `);

  const tx = db.transaction(() => {
    for (const item of mockIntegrations) {
      insert.run({
        id: item.id,
        name: item.name,
        type: item.type,
        url: item.url,
        events: JSON.stringify(item.events),
        active: item.active ? 1 : 0,
        description: "",
        config: null,
        success_rate: item.successRate,
        last_triggered: item.lastTriggered ?? null,
        created_at: now,
        updated_at: now,
      });
    }
  });
  tx();
  seeded = true;
}

export function listIntegrations(): Integration[] {
  ensureIntegrationsSeeded();
  const rows = getSqliteDb()
    .prepare("SELECT * FROM integrations ORDER BY datetime(created_at) DESC")
    .all() as IntegrationRow[];
  return rows.map(rowToIntegration);
}

export function getIntegration(id: string): Integration | null {
  ensureIntegrationsSeeded();
  const row = getSqliteDb().prepare("SELECT * FROM integrations WHERE id = ?").get(id) as IntegrationRow | undefined;
  return row ? rowToIntegration(row) : null;
}

export function createIntegration(input: {
  name: string;
  type: Integration["type"];
  url: string;
  events: string[];
  description?: string;
  config?: IntegrationConfig;
  active?: boolean;
}): Integration {
  ensureIntegrationsSeeded();
  const db = getSqliteDb();
  const now = new Date().toISOString();
  const id = `int_${randomBytes(6).toString("hex")}`;

  db.prepare(`
    INSERT INTO integrations (
      id, name, type, url, events, active, description, config, success_rate,
      total_deliveries, failed_deliveries, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 100, 0, 0, ?, ?)
  `).run(
    id,
    input.name.trim(),
    input.type,
    input.url.trim(),
    JSON.stringify(input.events),
    input.active === false ? 0 : 1,
    input.description?.trim() ?? "",
    input.config ? JSON.stringify(input.config) : null,
    now,
    now
  );

  return getIntegration(id)!;
}

export function updateIntegration(
  id: string,
  patch: Partial<{
    name: string;
    type: Integration["type"];
    url: string;
    events: string[];
    active: boolean;
    description: string;
    config: IntegrationConfig;
  }>
): Integration | null {
  const existing = getIntegration(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  getSqliteDb()
    .prepare(
      `UPDATE integrations SET
        name = ?, type = ?, url = ?, events = ?, active = ?, description = ?, config = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(
      patch.name ?? existing.name,
      patch.type ?? existing.type,
      patch.url ?? existing.url,
      JSON.stringify(patch.events ?? existing.events),
      (patch.active ?? existing.active) ? 1 : 0,
      patch.description ?? existing.description ?? "",
      JSON.stringify(patch.config ?? existing.config ?? null),
      now,
      id
    );

  return getIntegration(id);
}

export function deleteIntegration(id: string): boolean {
  const res = getSqliteDb().prepare("DELETE FROM integrations WHERE id = ?").run(id);
  return res.changes > 0;
}

export function recordDelivery(input: {
  integrationId: string;
  integrationName: string;
  event: string;
  success: boolean;
  statusCode?: number;
  error?: string;
  durationMs: number;
  payloadPreview: string;
}): IntegrationDelivery {
  const db = getSqliteDb();
  const id = `dlv_${randomBytes(6).toString("hex")}`;
  const createdAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO integration_deliveries (
      id, integration_id, integration_name, event, success, status_code, error, duration_ms, payload_preview, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.integrationId,
    input.integrationName,
    input.event,
    input.success ? 1 : 0,
    input.statusCode ?? null,
    input.error ?? null,
    input.durationMs,
    input.payloadPreview.slice(0, 2000),
    createdAt
  );

  db.prepare(
    `UPDATE integrations SET
      total_deliveries = total_deliveries + 1,
      failed_deliveries = failed_deliveries + ?,
      last_triggered = ?,
      success_rate = ROUND(100.0 * (total_deliveries + 1 - (failed_deliveries + ?)) / (total_deliveries + 1), 1),
      updated_at = ?
     WHERE id = ?`
  ).run(input.success ? 0 : 1, createdAt, input.success ? 0 : 1, createdAt, input.integrationId);

  pruneOldDeliveries();

  return {
    id,
    integrationId: input.integrationId,
    integrationName: input.integrationName,
    event: input.event,
    success: input.success,
    statusCode: input.statusCode,
    error: input.error,
    durationMs: input.durationMs,
    payloadPreview: input.payloadPreview,
    createdAt,
  };
}

function pruneOldDeliveries(): void {
  const db = getSqliteDb();
  const count = db.prepare("SELECT COUNT(*) AS c FROM integration_deliveries").get() as { c: number };
  if (count.c <= MAX_DELIVERIES) return;
  db.prepare(
    `DELETE FROM integration_deliveries WHERE id IN (
      SELECT id FROM integration_deliveries ORDER BY datetime(created_at) ASC LIMIT ?
    )`
  ).run(count.c - MAX_DELIVERIES);
}

export function listDeliveries(limit = 100, integrationId?: string): IntegrationDelivery[] {
  ensureIntegrationsSeeded();
  const db = getSqliteDb();
  const rows = integrationId
    ? (db
        .prepare(
          "SELECT * FROM integration_deliveries WHERE integration_id = ? ORDER BY datetime(created_at) DESC LIMIT ?"
        )
        .all(integrationId, limit) as DeliveryRow[])
    : (db
        .prepare("SELECT * FROM integration_deliveries ORDER BY datetime(created_at) DESC LIMIT ?")
        .all(limit) as DeliveryRow[]);

  return rows.map(deliveryFromRow);
}

type DeliveryRow = {
  id: string;
  integration_id: string;
  integration_name: string;
  event: string;
  success: number;
  status_code: number | null;
  error: string | null;
  duration_ms: number;
  payload_preview: string;
  created_at: string;
};

function deliveryFromRow(row: DeliveryRow): IntegrationDelivery {
  return {
    id: row.id,
    integrationId: row.integration_id,
    integrationName: row.integration_name,
    event: row.event,
    success: row.success === 1,
    statusCode: row.status_code ?? undefined,
    error: row.error ?? undefined,
    durationMs: row.duration_ms,
    payloadPreview: row.payload_preview,
    createdAt: row.created_at,
  };
}

export function getIntegrationOverview() {
  ensureIntegrationsSeeded();
  const db = getSqliteDb();
  const active = db.prepare("SELECT COUNT(*) AS c FROM integrations WHERE active = 1").get() as { c: number };

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const eventsToday = db
    .prepare("SELECT COUNT(*) AS c FROM integration_deliveries WHERE datetime(created_at) >= ?")
    .get(start.toISOString()) as { c: number };

  const rates = listIntegrations().filter((i) => (i.totalDeliveries ?? 0) > 0);
  const avgSuccess =
    rates.length > 0
      ? Math.round((rates.reduce((s, i) => s + i.successRate, 0) / rates.length) * 10) / 10
      : 100;

  const yesterdayStart = new Date(start);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayEnd = new Date(start);
  const eventsYesterday = db
    .prepare(
      "SELECT COUNT(*) AS c FROM integration_deliveries WHERE datetime(created_at) >= ? AND datetime(created_at) < ?"
    )
    .get(yesterdayStart.toISOString(), yesterdayEnd.toISOString()) as { c: number };

  const trend =
    eventsYesterday.c > 0
      ? Math.round(((eventsToday.c - eventsYesterday.c) / eventsYesterday.c) * 1000) / 10
      : eventsToday.c > 0
        ? 100
        : 0;

  return {
    activeCount: active.c,
    eventsToday: eventsToday.c,
    avgSuccessRate: avgSuccess,
    successTrend: trend,
  };
}

export function listActiveForEvent(event: string): Integration[] {
  return listIntegrations().filter((i) => i.active && i.events.includes(event));
}
