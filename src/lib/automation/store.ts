import { randomBytes } from "node:crypto";
import { getSqliteDb } from "@/lib/db/sqlite";
import type {
  AutomationRuleRecord,
  AutomationRunRecord,
  AutomationScheduledJob,
  ModerationSettings,
} from "./types";

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

let seeded = false;

function seedDefaults(): void {
  if (seeded) return;
  const db = getSqliteDb();
  const count = db.prepare("SELECT COUNT(*) AS c FROM automation_rules").get() as { c: number };
  if (count.c > 0) {
    seeded = true;
    return;
  }

  const now = new Date().toISOString();
  const defaults: Array<Omit<AutomationRuleRecord, "runCount" | "createdAt" | "updatedAt">> = [
    {
      id: "r1",
      name: "Auto-ban spam chat",
      triggerType: "chat.flags_threshold",
      triggerConfig: { count: 3, windowMinutes: 5 },
      actionType: "ban_user_temp",
      actionConfig: { hours: 24, reason: "Spam chat automático" },
      enabled: true,
      lastRun: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: "r2",
      name: "Notificar versión obsoleta",
      triggerType: "launcher.version_below",
      triggerConfig: { minVersion: "1.2.0" },
      actionType: "notify_launcher",
      actionConfig: {
        title: "Actualización disponible",
        message: "Tu launcher está desactualizado. Actualiza a la última versión.",
        target: "all",
      },
      enabled: true,
      lastRun: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: "r3",
      name: "Backup config diario",
      triggerType: "cron",
      triggerConfig: { hour: 3, minute: 0 },
      actionType: "export_data_backup",
      actionConfig: {},
      enabled: true,
      lastRun: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: "r4",
      name: "Welcome premium",
      triggerType: "user.premium",
      triggerConfig: {},
      actionType: "grant_points",
      actionConfig: { points: 500, message: "¡Bienvenido premium!" },
      enabled: false,
    },
    {
      id: "r5",
      name: "Alerta seguridad crítica → Discord",
      triggerType: "security.critical",
      triggerConfig: {},
      actionType: "dispatch_integration",
      actionConfig: { event: "security.critical" },
      enabled: true,
    },
    {
      id: "r6",
      name: "Experimento completado → notificar",
      triggerType: "experiment.completed",
      triggerConfig: {},
      actionType: "notify_admin",
      actionConfig: { event: "experiment.completed" },
      enabled: true,
    },
  ];

  const insert = db.prepare(`
    INSERT INTO automation_rules (
      id, name, trigger_type, trigger_config, action_type, action_config,
      enabled, run_count, last_run, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    for (const rule of defaults) {
      insert.run(
        rule.id,
        rule.name,
        rule.triggerType,
        JSON.stringify(rule.triggerConfig),
        rule.actionType,
        JSON.stringify(rule.actionConfig),
        rule.enabled ? 1 : 0,
        0,
        rule.lastRun ?? null,
        now,
        now
      );
    }

    const mod = db.prepare("SELECT COUNT(*) AS c FROM automation_moderation").get() as { c: number };
    if (mod.c === 0) {
      db.prepare(`
        INSERT INTO automation_moderation (
          id, word_filter, spam_detect, block_links, slow_mode, blacklist,
          flagged_action, report_action, updated_at
        ) VALUES ('default', 1, 1, 1, 0, '[]', 'mute_24h', 'notify', ?)
      `).run(now);
    }
  });
  tx();
  seeded = true;
}

type RuleRow = {
  id: string;
  name: string;
  trigger_type: string;
  trigger_config: string;
  action_type: string;
  action_config: string;
  enabled: number;
  run_count: number;
  last_run: string | null;
  created_at: string;
  updated_at: string;
};

function rowToRule(row: RuleRow): AutomationRuleRecord {
  return {
    id: row.id,
    name: row.name,
    triggerType: row.trigger_type as AutomationRuleRecord["triggerType"],
    triggerConfig: parseJson(row.trigger_config, {}),
    actionType: row.action_type as AutomationRuleRecord["actionType"],
    actionConfig: parseJson(row.action_config, {}),
    enabled: row.enabled === 1,
    runCount: row.run_count,
    lastRun: row.last_run ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listAutomationRules(): AutomationRuleRecord[] {
  seedDefaults();
  const rows = getSqliteDb()
    .prepare("SELECT * FROM automation_rules ORDER BY datetime(created_at) DESC")
    .all() as RuleRow[];
  return rows.map(rowToRule);
}

export function getAutomationRule(id: string): AutomationRuleRecord | null {
  seedDefaults();
  const row = getSqliteDb().prepare("SELECT * FROM automation_rules WHERE id = ?").get(id) as RuleRow | undefined;
  return row ? rowToRule(row) : null;
}

export function listEnabledRulesForTrigger(trigger: string): AutomationRuleRecord[] {
  return listAutomationRules().filter((r) => r.enabled && r.triggerType === trigger);
}

export function createAutomationRule(
  input: Omit<AutomationRuleRecord, "id" | "runCount" | "createdAt" | "updatedAt" | "lastRun">
): AutomationRuleRecord {
  seedDefaults();
  const now = new Date().toISOString();
  const id = `rule_${randomBytes(5).toString("hex")}`;
  getSqliteDb()
    .prepare(
      `INSERT INTO automation_rules (
        id, name, trigger_type, trigger_config, action_type, action_config,
        enabled, run_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    )
    .run(
      id,
      input.name,
      input.triggerType,
      JSON.stringify(input.triggerConfig),
      input.actionType,
      JSON.stringify(input.actionConfig),
      input.enabled ? 1 : 0,
      now,
      now
    );
  return getAutomationRule(id)!;
}

export function updateAutomationRule(
  id: string,
  patch: Partial<AutomationRuleRecord>
): AutomationRuleRecord | null {
  const existing = getAutomationRule(id);
  if (!existing) return null;
  const now = new Date().toISOString();
  getSqliteDb()
    .prepare(
      `UPDATE automation_rules SET
        name = ?, trigger_type = ?, trigger_config = ?, action_type = ?, action_config = ?,
        enabled = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(
      patch.name ?? existing.name,
      patch.triggerType ?? existing.triggerType,
      JSON.stringify(patch.triggerConfig ?? existing.triggerConfig),
      patch.actionType ?? existing.actionType,
      JSON.stringify(patch.actionConfig ?? existing.actionConfig),
      (patch.enabled ?? existing.enabled) ? 1 : 0,
      now,
      id
    );
  return getAutomationRule(id);
}

export function deleteAutomationRule(id: string): boolean {
  return getSqliteDb().prepare("DELETE FROM automation_rules WHERE id = ?").run(id).changes > 0;
}

export function markRuleRun(id: string): void {
  const now = new Date().toISOString();
  getSqliteDb()
    .prepare("UPDATE automation_rules SET run_count = run_count + 1, last_run = ?, updated_at = ? WHERE id = ?")
    .run(now, now, id);
}

export function insertAutomationRun(input: Omit<AutomationRunRecord, "id" | "createdAt">): AutomationRunRecord {
  const id = `run_${randomBytes(5).toString("hex")}`;
  const createdAt = new Date().toISOString();
  getSqliteDb()
    .prepare(
      `INSERT INTO automation_runs (id, rule_id, rule_name, trigger_event, success, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, input.ruleId, input.ruleName, input.triggerEvent, input.success ? 1 : 0, input.detail, createdAt);

  const db = getSqliteDb();
  const count = db.prepare("SELECT COUNT(*) AS c FROM automation_runs").get() as { c: number };
  if (count.c > 400) {
    db.prepare(
      `DELETE FROM automation_runs WHERE id IN (
        SELECT id FROM automation_runs ORDER BY datetime(created_at) ASC LIMIT ?
      )`
    ).run(count.c - 400);
  }

  return { ...input, id, createdAt };
}

export function listAutomationRuns(limit = 80): AutomationRunRecord[] {
  seedDefaults();
  return (
    getSqliteDb()
      .prepare("SELECT * FROM automation_runs ORDER BY datetime(created_at) DESC LIMIT ?")
      .all(limit) as Array<{
      id: string;
      rule_id: string;
      rule_name: string;
      trigger_event: string;
      success: number;
      detail: string;
      created_at: string;
    }>
  ).map((r) => ({
    id: r.id,
    ruleId: r.rule_id,
    ruleName: r.rule_name,
    triggerEvent: r.trigger_event,
    success: r.success === 1,
    detail: r.detail,
    createdAt: r.created_at,
  }));
}

export function getModerationSettings(): ModerationSettings {
  seedDefaults();
  const row = getSqliteDb().prepare("SELECT * FROM automation_moderation WHERE id = 'default'").get() as
    | {
        word_filter: number;
        spam_detect: number;
        block_links: number;
        slow_mode: number;
        blacklist: string;
        flagged_action: string;
        report_action: string;
        updated_at: string;
      }
    | undefined;

  if (!row) {
    const now = new Date().toISOString();
    return {
      wordFilter: true,
      spamDetect: true,
      blockLinks: true,
      slowMode: false,
      blacklist: [],
      flaggedAction: "mute_24h",
      reportAction: "notify",
      updatedAt: now,
    };
  }

  return {
    wordFilter: row.word_filter === 1,
    spamDetect: row.spam_detect === 1,
    blockLinks: row.block_links === 1,
    slowMode: row.slow_mode === 1,
    blacklist: parseJson<string[]>(row.blacklist, []),
    flaggedAction: row.flagged_action as ModerationSettings["flaggedAction"],
    reportAction: row.report_action as ModerationSettings["reportAction"],
    updatedAt: row.updated_at,
  };
}

export function saveModerationSettings(settings: ModerationSettings): ModerationSettings {
  const now = new Date().toISOString();
  getSqliteDb()
    .prepare(
      `INSERT INTO automation_moderation (
        id, word_filter, spam_detect, block_links, slow_mode, blacklist,
        flagged_action, report_action, updated_at
      ) VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        word_filter = excluded.word_filter,
        spam_detect = excluded.spam_detect,
        block_links = excluded.block_links,
        slow_mode = excluded.slow_mode,
        blacklist = excluded.blacklist,
        flagged_action = excluded.flagged_action,
        report_action = excluded.report_action,
        updated_at = excluded.updated_at`
    )
    .run(
      settings.wordFilter ? 1 : 0,
      settings.spamDetect ? 1 : 0,
      settings.blockLinks ? 1 : 0,
      settings.slowMode ? 1 : 0,
      JSON.stringify(settings.blacklist),
      settings.flaggedAction,
      settings.reportAction,
      now
    );
  return { ...settings, updatedAt: now };
}

export function recordChatFlag(username: string, reason?: string): number {
  const id = `cf_${randomBytes(4).toString("hex")}`;
  const now = new Date().toISOString();
  getSqliteDb()
    .prepare("INSERT INTO automation_chat_flags (id, username, reason, flagged_at) VALUES (?, ?, ?, ?)")
    .run(id, username.toLowerCase(), reason ?? null, now);
  return countChatFlags(username, 60);
}

export function countChatFlags(username: string, windowMinutes: number): number {
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const row = getSqliteDb()
    .prepare("SELECT COUNT(*) AS c FROM automation_chat_flags WHERE username = ? AND flagged_at >= ?")
    .get(username.toLowerCase(), since) as { c: number };
  return row.c;
}

export function addTempBan(input: {
  userId: string;
  username: string;
  hours: number;
  reason?: string;
  ruleId?: string;
}): void {
  const until = new Date(Date.now() + input.hours * 3600_000).toISOString();
  getSqliteDb()
    .prepare(
      `INSERT INTO automation_temp_bans (user_id, username, until_at, reason, rule_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET until_at = excluded.until_at, reason = excluded.reason, rule_id = excluded.rule_id`
    )
    .run(input.userId, input.username, until, input.reason ?? null, input.ruleId ?? null, new Date().toISOString());
}

export function isTempBanned(userId: string): { banned: boolean; until?: string; reason?: string } {
  const row = getSqliteDb()
    .prepare("SELECT until_at, reason FROM automation_temp_bans WHERE user_id = ?")
    .get(userId) as { until_at: string; reason: string | null } | undefined;
  if (!row) return { banned: false };
  if (Date.parse(row.until_at) <= Date.now()) {
    getSqliteDb().prepare("DELETE FROM automation_temp_bans WHERE user_id = ?").run(userId);
    return { banned: false };
  }
  return { banned: true, until: row.until_at, reason: row.reason ?? undefined };
}

export function grantPoints(userId: string, username: string, points: number): number {
  const now = new Date().toISOString();
  getSqliteDb()
    .prepare(
      `INSERT INTO automation_points (user_id, username, points, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET points = points + excluded.points, updated_at = excluded.updated_at`
    )
    .run(userId, username, points, now);
  const row = getSqliteDb().prepare("SELECT points FROM automation_points WHERE user_id = ?").get(userId) as {
    points: number;
  };
  return row.points;
}

export function listScheduledJobs(): AutomationScheduledJob[] {
  seedDefaults();
  const rows = getSqliteDb()
    .prepare("SELECT * FROM automation_scheduled_jobs ORDER BY datetime(scheduled_at) ASC")
    .all() as Array<{
    id: string;
    name: string;
    action: string;
    scheduled_at: string;
    recurring: string | null;
    target: string;
    payload: string;
    status: string;
    last_run_at: string | null;
    next_run_at: string | null;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    action: r.action as AutomationScheduledJob["action"],
    scheduledAt: r.scheduled_at,
    recurring: (r.recurring as AutomationScheduledJob["recurring"]) ?? undefined,
    target: r.target as AutomationScheduledJob["target"],
    payload: parseJson(r.payload, {}),
    status: r.status as AutomationScheduledJob["status"],
    lastRunAt: r.last_run_at ?? undefined,
    nextRunAt: r.next_run_at ?? undefined,
  }));
}

export function createScheduledJob(
  job: Omit<AutomationScheduledJob, "id" | "status" | "lastRunAt" | "nextRunAt"> & { status?: AutomationScheduledJob["status"] }
): AutomationScheduledJob {
  const id = `job_${randomBytes(5).toString("hex")}`;
  const now = new Date().toISOString();
  getSqliteDb()
    .prepare(
      `INSERT INTO automation_scheduled_jobs (
        id, name, action, scheduled_at, recurring, target, payload, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
    )
    .run(
      id,
      job.name,
      job.action,
      job.scheduledAt,
      job.recurring ?? null,
      job.target,
      JSON.stringify(job.payload),
      now,
      now
    );
  return listScheduledJobs().find((j) => j.id === id)!;
}

export function updateScheduledJobStatus(id: string, status: AutomationScheduledJob["status"], lastRunAt?: string): void {
  const now = new Date().toISOString();
  getSqliteDb()
    .prepare("UPDATE automation_scheduled_jobs SET status = ?, last_run_at = ?, updated_at = ? WHERE id = ?")
    .run(status, lastRunAt ?? now, now, id);
}

export function getAutomationOverview() {
  seedDefaults();
  const db = getSqliteDb();
  const activeRules = db.prepare("SELECT COUNT(*) AS c FROM automation_rules WHERE enabled = 1").get() as { c: number };
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const runsToday = db
    .prepare("SELECT COUNT(*) AS c FROM automation_runs WHERE datetime(created_at) >= ?")
    .get(start.toISOString()) as { c: number };
  const pendingJobs = db
    .prepare("SELECT COUNT(*) AS c FROM automation_scheduled_jobs WHERE status = 'pending'")
    .get() as { c: number };
  const tempBans = db.prepare("SELECT COUNT(*) AS c FROM automation_temp_bans").get() as { c: number };
  return { activeRules: activeRules.c, runsToday: runsToday.c, pendingJobs: pendingJobs.c, tempBans: tempBans.c };
}

export function getSystemState(key: string): string | null {
  const row = getSqliteDb().prepare("SELECT value FROM automation_system_state WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSystemState(key: string, value: string): void {
  const now = new Date().toISOString();
  getSqliteDb()
    .prepare(
      `INSERT INTO automation_system_state (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .run(key, value, now);
}
