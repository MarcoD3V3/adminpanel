import { randomBytes } from "node:crypto";
import { getSqliteDb } from "@/lib/db/sqlite";
import type { Mission, MissionMetric, MissionType } from "@/types/features";
import type {
  GrantPointsInput,
  MissionRecord,
  PointTransaction,
  RedeemableRecord,
  RewardEconomy,
  RewardTierRecord,
  UserRewardsProfile,
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

function now(): string {
  return new Date().toISOString();
}

function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function weekKey(d = new Date()): string {
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

export function missionPeriodKey(type: MissionType, d = new Date()): string {
  if (type === "daily") return `daily:${dayKey(d)}`;
  if (type === "weekly") return `weekly:${weekKey(d)}`;
  return "special";
}

function migrateAutomationPoints(): void {
  const db = getSqliteDb();
  const legacy = db.prepare("SELECT user_id, username, points, updated_at FROM automation_points").all() as Array<{
    user_id: string;
    username: string;
    points: number;
    updated_at: string;
  }>;
  if (legacy.length === 0) return;
  const insert = db.prepare(
    `INSERT OR IGNORE INTO rewards_users (user_id, username, points, lifetime_points, referral_code, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const tx = db.transaction(() => {
    for (const row of legacy) {
      const code = `REF_${row.user_id.slice(-6).toUpperCase()}`;
      insert.run(row.user_id, row.username, row.points, row.points, code, row.updated_at);
    }
  });
  tx();
}

function seedDefaults(): void {
  if (seeded) return;
  const db = getSqliteDb();
  migrateAutomationPoints();

  const econ = db.prepare("SELECT COUNT(*) AS c FROM rewards_economy").get() as { c: number };
  if (econ.c === 0) {
    db.prepare(
      `INSERT INTO rewards_economy (id, points_per_hour, daily_bonus, referral_bonus, event_bonus, xp_multiplier, updated_at)
       VALUES ('default', 10, 50, 200, 100, 1, ?)`
    ).run(now());
  }

  const tiers = db.prepare("SELECT COUNT(*) AS c FROM rewards_tiers").get() as { c: number };
  if (tiers.c === 0) {
    const ts = now();
    const defaults = [
      { id: "t1", name: "Explorador", pts: 0, perks: ["Avatar básico", "Chat global"], order: 0 },
      { id: "t2", name: "Artesano", pts: 500, perks: ["Capas exclusivas", "Prioridad en servidores"], order: 1 },
      { id: "t3", name: "Leyenda", pts: 2000, perks: ["Modpacks premium", "Badge dorado", "Eventos VIP"], order: 2 },
    ];
    const ins = db.prepare(
      `INSERT INTO rewards_tiers (id, name, points_required, perks, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const t of defaults) {
      ins.run(t.id, t.name, t.pts, JSON.stringify(t.perks), t.order, ts, ts);
    }
  }

  const missions = db.prepare("SELECT COUNT(*) AS c FROM rewards_missions").get() as { c: number };
  if (missions.c === 0) {
    const ts = now();
    const defaults: Array<Omit<Mission, "completions"> & { id: string; completions?: number }> = [
      { id: "m1", title: "Jugar 1 hora", description: "Acumula 60 minutos en Minecraft", type: "daily", metric: "play_time", target: 60, rewardPoints: 50, active: true },
      { id: "m2", title: "Inicia sesión", description: "Abre el launcher hoy", type: "daily", metric: "login", target: 1, rewardPoints: 25, active: true },
      { id: "m3", title: "Invita un amigo", description: "Un amigo se registra con tu código", type: "weekly", metric: "invite", target: 1, rewardPoints: 200, active: true },
      { id: "m4", title: "5 mensajes en chat", description: "Participa en el chat global", type: "daily", metric: "chat", target: 5, rewardPoints: 30, active: true },
      { id: "m5", title: "Instala un modpack", description: "Instala cualquier modpack premium", type: "special", metric: "modpack_install", target: 1, rewardPoints: 150, active: true, expiresAt: "2026-12-31T00:00:00Z" },
    ];
    const ins = db.prepare(
      `INSERT INTO rewards_missions (id, title, description, type, metric, target, reward_points, active, completions, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?)`
    );
    for (const m of defaults) {
      ins.run(m.id, m.title, m.description, m.type, m.metric, m.target, m.rewardPoints, m.expiresAt ?? null, ts, ts);
    }
  }

  const redeem = db.prepare("SELECT COUNT(*) AS c FROM rewards_redeemables").get() as { c: number };
  if (redeem.c === 0) {
    const ts = now();
    const defaults = [
      { id: "rd1", name: "Capa exclusiva", desc: "Capa cosmética premium", cost: 500, cat: "cosmetic" },
      { id: "rd2", name: "Avatar animado", desc: "Avatar con animación", cost: 300, cat: "cosmetic" },
      { id: "rd3", name: "Modpack premium", desc: "Desbloqueo temporal modpack VIP", cost: 800, cat: "modpack" },
      { id: "rd4", name: "Badge especial", desc: "Badge en perfil social", cost: 150, cat: "badge" },
    ];
    const ins = db.prepare(
      `INSERT INTO rewards_redeemables (id, name, description, cost, category, active, redemptions, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)`
    );
    for (const r of defaults) {
      ins.run(r.id, r.name, r.desc, r.cost, r.cat, ts, ts);
    }
  }

  seeded = true;
}

export function getEconomy(): RewardEconomy {
  seedDefaults();
  const row = getSqliteDb().prepare("SELECT * FROM rewards_economy WHERE id = 'default'").get() as {
    points_per_hour: number;
    daily_bonus: number;
    referral_bonus: number;
    event_bonus: number;
    xp_multiplier: number;
    updated_at: string;
  };
  return {
    pointsPerHour: row.points_per_hour,
    dailyBonus: row.daily_bonus,
    referralBonus: row.referral_bonus,
    eventBonus: row.event_bonus,
    xpMultiplier: row.xp_multiplier,
    updatedAt: row.updated_at,
  };
}

export function saveEconomy(patch: Partial<RewardEconomy>): RewardEconomy {
  seedDefaults();
  const current = getEconomy();
  const next = { ...current, ...patch, updatedAt: now() };
  getSqliteDb()
    .prepare(
      `UPDATE rewards_economy SET points_per_hour = ?, daily_bonus = ?, referral_bonus = ?, event_bonus = ?, xp_multiplier = ?, updated_at = ? WHERE id = 'default'`
    )
    .run(next.pointsPerHour, next.dailyBonus, next.referralBonus, next.eventBonus, next.xpMultiplier, next.updatedAt);
  return next;
}

function countTierMembers(pointsRequired: number, nextThreshold?: number): number {
  seedDefaults();
  let sql = "SELECT COUNT(*) AS c FROM rewards_users WHERE points >= ?";
  const params: number[] = [pointsRequired];
  if (nextThreshold !== undefined) {
    sql += " AND points < ?";
    params.push(nextThreshold);
  }
  const row = getSqliteDb().prepare(sql).get(...params) as { c: number };
  return row.c;
}

export function listTiers(): RewardTierRecord[] {
  seedDefaults();
  const rows = getSqliteDb()
    .prepare("SELECT * FROM rewards_tiers ORDER BY sort_order ASC, points_required ASC")
    .all() as Array<{
    id: string;
    name: string;
    points_required: number;
    perks: string;
    sort_order: number;
    created_at: string;
    updated_at: string;
  }>;
  const sorted = rows.map((r, i) => ({
    id: r.id,
    name: r.name,
    pointsRequired: r.points_required,
    perks: parseJson<string[]>(r.perks, []),
    sortOrder: r.sort_order,
    members: countTierMembers(r.points_required, rows[i + 1]?.points_required),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
  return sorted;
}

export function createTier(input: { name: string; pointsRequired: number; perks: string[] }): RewardTierRecord {
  seedDefaults();
  const id = `tier_${randomBytes(4).toString("hex")}`;
  const ts = now();
  const order = listTiers().length;
  getSqliteDb()
    .prepare(
      `INSERT INTO rewards_tiers (id, name, points_required, perks, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, input.name, input.pointsRequired, JSON.stringify(input.perks), order, ts, ts);
  return listTiers().find((t) => t.id === id)!;
}

export function updateTier(id: string, patch: Partial<{ name: string; pointsRequired: number; perks: string[] }>): RewardTierRecord | null {
  const existing = listTiers().find((t) => t.id === id);
  if (!existing) return null;
  getSqliteDb()
    .prepare(`UPDATE rewards_tiers SET name = ?, points_required = ?, perks = ?, updated_at = ? WHERE id = ?`)
    .run(
      patch.name ?? existing.name,
      patch.pointsRequired ?? existing.pointsRequired,
      JSON.stringify(patch.perks ?? existing.perks),
      now(),
      id
    );
  return listTiers().find((t) => t.id === id) ?? null;
}

export function deleteTier(id: string): boolean {
  return getSqliteDb().prepare("DELETE FROM rewards_tiers WHERE id = ?").run(id).changes > 0;
}

export function listRedeemables(): RedeemableRecord[] {
  seedDefaults();
  return (
    getSqliteDb().prepare("SELECT * FROM rewards_redeemables ORDER BY cost ASC").all() as Array<{
      id: string;
      name: string;
      description: string;
      cost: number;
      category: string;
      active: number;
      stock: number | null;
      redemptions: number;
      created_at: string;
      updated_at: string;
    }>
  ).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    cost: r.cost,
    category: r.category as RedeemableRecord["category"],
    active: r.active === 1,
    stock: r.stock ?? undefined,
    redemptions: r.redemptions,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function createRedeemable(input: {
  name: string;
  description: string;
  cost: number;
  category: RedeemableRecord["category"];
}): RedeemableRecord {
  seedDefaults();
  const id = `rd_${randomBytes(4).toString("hex")}`;
  const ts = now();
  getSqliteDb()
    .prepare(
      `INSERT INTO rewards_redeemables (id, name, description, cost, category, active, redemptions, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)`
    )
    .run(id, input.name, input.description, input.cost, input.category, ts, ts);
  return listRedeemables().find((r) => r.id === id)!;
}

function rowToMission(row: {
  id: string;
  title: string;
  description: string;
  type: string;
  metric: string;
  target: number;
  reward_points: number;
  active: number;
  completions: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}): MissionRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.type as MissionType,
    metric: row.metric as MissionMetric,
    target: row.target,
    rewardPoints: row.reward_points,
    active: row.active === 1,
    completions: row.completions,
    expiresAt: row.expires_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listMissions(): MissionRecord[] {
  seedDefaults();
  const rows = getSqliteDb().prepare("SELECT * FROM rewards_missions ORDER BY type, title").all() as Parameters<
    typeof rowToMission
  >[0][];
  return rows.map(rowToMission);
}

export function getMission(id: string): MissionRecord | null {
  const row = getSqliteDb().prepare("SELECT * FROM rewards_missions WHERE id = ?").get(id) as Parameters<
    typeof rowToMission
  >[0] | undefined;
  return row ? rowToMission(row) : null;
}

export function createMission(input: Omit<Mission, "id" | "completions">): MissionRecord {
  seedDefaults();
  const id = `m_${randomBytes(4).toString("hex")}`;
  const ts = now();
  getSqliteDb()
    .prepare(
      `INSERT INTO rewards_missions (id, title, description, type, metric, target, reward_points, active, completions, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
    )
    .run(
      id,
      input.title,
      input.description,
      input.type,
      input.metric,
      input.target,
      input.rewardPoints,
      input.active ? 1 : 0,
      input.expiresAt ?? null,
      ts,
      ts
    );
  return getMission(id)!;
}

export function updateMission(id: string, patch: Partial<Mission>): MissionRecord | null {
  const existing = getMission(id);
  if (!existing) return null;
  getSqliteDb()
    .prepare(
      `UPDATE rewards_missions SET title = ?, description = ?, type = ?, metric = ?, target = ?, reward_points = ?, active = ?, expires_at = ?, updated_at = ? WHERE id = ?`
    )
    .run(
      patch.title ?? existing.title,
      patch.description ?? existing.description,
      patch.type ?? existing.type,
      patch.metric ?? existing.metric,
      patch.target ?? existing.target,
      patch.rewardPoints ?? existing.rewardPoints,
      (patch.active ?? existing.active) ? 1 : 0,
      patch.expiresAt ?? existing.expiresAt ?? null,
      now(),
      id
    );
  return getMission(id);
}

export function bumpMissionCompletions(missionId: string): void {
  getSqliteDb().prepare("UPDATE rewards_missions SET completions = completions + 1 WHERE id = ?").run(missionId);
}

export function ensureUser(userId: string, username: string): UserRewardsProfile {
  seedDefaults();
  const existing = getSqliteDb().prepare("SELECT * FROM rewards_users WHERE user_id = ?").get(userId) as
    | Record<string, unknown>
    | undefined;
  if (existing) {
    return mapUserRow(existing);
  }
  const code = `REF_${userId.slice(-6).toUpperCase()}${randomBytes(2).toString("hex").toUpperCase()}`;
  const ts = now();
  getSqliteDb()
    .prepare(
      `INSERT INTO rewards_users (user_id, username, points, lifetime_points, referral_code, updated_at) VALUES (?, ?, 0, 0, ?, ?)`
    )
    .run(userId, username, code, ts);
  return ensureUser(userId, username);
}

function mapUserRow(row: Record<string, unknown>): UserRewardsProfile {
  const tiers = listTiers();
  const points = row.points as number;
  const tier = [...tiers].reverse().find((t) => points >= t.pointsRequired);
  return {
    userId: row.user_id as string,
    username: row.username as string,
    points,
    lifetimePoints: row.lifetime_points as number,
    tierId: tier?.id,
    tierName: tier?.name,
    referralCode: row.referral_code as string,
    referredBy: (row.referred_by as string) ?? undefined,
    lastDailyBonus: (row.last_daily_bonus as string) ?? undefined,
    lastLoginDate: (row.last_login_date as string) ?? undefined,
    updatedAt: row.updated_at as string,
  };
}

export function getUserProfile(userId: string): UserRewardsProfile | null {
  seedDefaults();
  const row = getSqliteDb().prepare("SELECT * FROM rewards_users WHERE user_id = ?").get(userId) as
    | Record<string, unknown>
    | undefined;
  return row ? mapUserRow(row) : null;
}

export function grantPoints(input: GrantPointsInput): { points: number; transaction: PointTransaction } {
  seedDefaults();
  const user = ensureUser(input.userId, input.username);
  const economy = getEconomy();
  const amount = Math.round(input.amount * economy.xpMultiplier);
  const balance = user.points + amount;
  const lifetime = user.lifetimePoints + Math.max(0, amount);
  const ts = now();
  const tiers = listTiers();
  const tier = [...tiers].reverse().find((t) => balance >= t.pointsRequired);

  getSqliteDb()
    .prepare(
      `UPDATE rewards_users SET points = ?, lifetime_points = ?, tier_id = ?, username = ?, updated_at = ? WHERE user_id = ?`
    )
    .run(balance, lifetime, tier?.id ?? null, input.username, ts, input.userId);

  const txId = `ptx_${randomBytes(5).toString("hex")}`;
  getSqliteDb()
    .prepare(
      `INSERT INTO rewards_point_log (id, user_id, username, amount, balance_after, reason, source, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      txId,
      input.userId,
      input.username,
      amount,
      balance,
      input.reason,
      input.source,
      input.metadata ? JSON.stringify(input.metadata) : null,
      ts
    );

  const db = getSqliteDb();
  const count = db.prepare("SELECT COUNT(*) AS c FROM rewards_point_log").get() as { c: number };
  if (count.c > 500) {
    db.prepare(
      `DELETE FROM rewards_point_log WHERE id IN (SELECT id FROM rewards_point_log ORDER BY datetime(created_at) ASC LIMIT ?)`
    ).run(count.c - 500);
  }

  return {
    points: balance,
    transaction: {
      id: txId,
      userId: input.userId,
      username: input.username,
      amount,
      balanceAfter: balance,
      reason: input.reason,
      source: input.source,
      createdAt: ts,
    },
  };
}

export function spendPoints(userId: string, username: string, cost: number, reason: string): boolean {
  const profile = getUserProfile(userId);
  if (!profile || profile.points < cost) return false;
  grantPoints({ userId, username, amount: -cost, reason, source: "redemption" });
  return true;
}

export function listRecentTransactions(limit = 30): PointTransaction[] {
  seedDefaults();
  return (
    getSqliteDb()
      .prepare("SELECT * FROM rewards_point_log ORDER BY datetime(created_at) DESC LIMIT ?")
      .all(limit) as Array<{
      id: string;
      user_id: string;
      username: string;
      amount: number;
      balance_after: number;
      reason: string;
      source: string;
      created_at: string;
    }>
  ).map((r) => ({
    id: r.id,
    userId: r.user_id,
    username: r.username,
    amount: r.amount,
    balanceAfter: r.balance_after,
    reason: r.reason,
    source: r.source,
    createdAt: r.created_at,
  }));
}

export function getMissionProgress(userId: string, missionId: string, periodKey: string): number {
  const row = getSqliteDb()
    .prepare("SELECT progress, completed FROM rewards_mission_progress WHERE user_id = ? AND mission_id = ? AND period_key = ?")
    .get(userId, missionId, periodKey) as { progress: number; completed: number } | undefined;
  return row?.completed ? row.progress : (row?.progress ?? 0);
}

export function isMissionCompleted(userId: string, missionId: string, periodKey: string): boolean {
  const row = getSqliteDb()
    .prepare("SELECT completed FROM rewards_mission_progress WHERE user_id = ? AND mission_id = ? AND period_key = ?")
    .get(userId, missionId, periodKey) as { completed: number } | undefined;
  return row?.completed === 1;
}

export function advanceMissionProgress(
  userId: string,
  mission: MissionRecord,
  delta: number
): { progress: number; completed: boolean; justCompleted: boolean } {
  const periodKey = missionPeriodKey(mission.type);
  if (isMissionCompleted(userId, mission.id, periodKey)) {
    return { progress: mission.target, completed: true, justCompleted: false };
  }

  const id = `mp_${randomBytes(5).toString("hex")}`;
  const ts = now();
  const existing = getSqliteDb()
    .prepare("SELECT id, progress FROM rewards_mission_progress WHERE user_id = ? AND mission_id = ? AND period_key = ?")
    .get(userId, mission.id, periodKey) as { id: string; progress: number } | undefined;

  const nextProgress = Math.min(mission.target, (existing?.progress ?? 0) + delta);
  const completed = nextProgress >= mission.target;

  if (existing) {
    getSqliteDb()
      .prepare(`UPDATE rewards_mission_progress SET progress = ?, completed = ?, completed_at = ?, updated_at = ? WHERE id = ?`)
      .run(nextProgress, completed ? 1 : 0, completed ? ts : null, ts, existing.id);
  } else {
    getSqliteDb()
      .prepare(
        `INSERT INTO rewards_mission_progress (id, user_id, mission_id, period_key, progress, completed, completed_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, userId, mission.id, periodKey, nextProgress, completed ? 1 : 0, completed ? ts : null, ts);
  }

  const justCompleted = completed && !(existing && existing.progress >= mission.target);
  return { progress: nextProgress, completed, justCompleted };
}

export function recordPlayMinutes(userId: string, username: string, minutes: number): number {
  seedDefaults();
  ensureUser(userId, username);
  const key = dayKey();
  const row = getSqliteDb().prepare("SELECT play_minutes_today, play_day_key FROM rewards_users WHERE user_id = ?").get(userId) as
    | { play_minutes_today: number; play_day_key: string | null }
    | undefined;
  const current = row?.play_day_key === key ? row.play_minutes_today : 0;
  const next = current + minutes;
  getSqliteDb()
    .prepare("UPDATE rewards_users SET play_minutes_today = ?, play_day_key = ?, last_heartbeat_at = ?, updated_at = ? WHERE user_id = ?")
    .run(next, key, now(), now(), userId);
  return next;
}

export function recordChatMessage(userId: string): number {
  const key = dayKey();
  const row = getSqliteDb().prepare("SELECT chat_count_today, chat_day_key FROM rewards_users WHERE user_id = ?").get(userId) as
    | { chat_count_today: number; chat_day_key: string | null }
    | undefined;
  const current = row?.chat_day_key === key ? row.chat_count_today : 0;
  const next = current + 1;
  getSqliteDb()
    .prepare("UPDATE rewards_users SET chat_count_today = ?, chat_day_key = ?, updated_at = ? WHERE user_id = ?")
    .run(next, key, now(), userId);
  return next;
}

export function setReferredBy(userId: string, referralCode: string): string | null {
  const referrer = getSqliteDb()
    .prepare("SELECT user_id, username FROM rewards_users WHERE referral_code = ?")
    .get(referralCode.toUpperCase()) as { user_id: string; username: string } | undefined;
  if (!referrer || referrer.user_id === userId) return null;
  getSqliteDb().prepare("UPDATE rewards_users SET referred_by = ? WHERE user_id = ?").run(referrer.user_id, userId);
  return referrer.user_id;
}

export function getOverview(): {
  totalUsers: number;
  totalPointsAwarded: number;
  redemptionsToday: number;
  missionsCompletedToday: number;
  topTierName: string;
} {
  seedDefaults();
  const db = getSqliteDb();
  const users = db.prepare("SELECT COUNT(*) AS c FROM rewards_users").get() as { c: number };
  const lifetime = db.prepare("SELECT COALESCE(SUM(lifetime_points), 0) AS s FROM rewards_users").get() as { s: number };
  const start = dayKey();
  const redemptions = db
    .prepare("SELECT COUNT(*) AS c FROM rewards_redemptions WHERE created_at >= ?")
    .get(`${start}T00:00:00.000Z`) as { c: number };
  const missionsDone = db
    .prepare("SELECT COUNT(*) AS c FROM rewards_mission_progress WHERE completed = 1 AND completed_at >= ?")
    .get(`${start}T00:00:00.000Z`) as { c: number };
  const tiers = listTiers();
  return {
    totalUsers: users.c,
    totalPointsAwarded: lifetime.s,
    redemptionsToday: redemptions.c,
    missionsCompletedToday: missionsDone.c,
    topTierName: tiers[tiers.length - 1]?.name ?? "—",
  };
}

export function redeemItem(userId: string, username: string, redeemableId: string): { ok: boolean; error?: string } {
  const item = listRedeemables().find((r) => r.id === redeemableId && r.active);
  if (!item) return { ok: false, error: "Canjeable no encontrado" };
  if (item.stock !== undefined && item.stock <= 0) return { ok: false, error: "Sin stock" };
  if (!spendPoints(userId, username, item.cost, `Canje: ${item.name}`)) {
    return { ok: false, error: "Puntos insuficientes" };
  }
  const id = `rx_${randomBytes(5).toString("hex")}`;
  getSqliteDb()
    .prepare(
      `INSERT INTO rewards_redemptions (id, user_id, username, redeemable_id, redeemable_name, cost, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, userId, username, item.id, item.name, item.cost, now());
  getSqliteDb().prepare("UPDATE rewards_redeemables SET redemptions = redemptions + 1, stock = CASE WHEN stock IS NULL THEN NULL ELSE stock - 1 END WHERE id = ?").run(item.id);
  return { ok: true };
}

export { dayKey, weekKey };
