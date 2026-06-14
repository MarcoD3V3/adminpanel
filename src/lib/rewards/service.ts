import { emitSystemEvent } from "@/lib/system-events";
import type { MissionMetric } from "@/types/features";
import type { MissionProgressView, RewardsDashboard, RewardsEventInput, UserRewardsProfile } from "./types";
import {
  advanceMissionProgress,
  bumpMissionCompletions,
  createMission,
  createRedeemable,
  createTier,
  deleteTier,
  getEconomy,
  getMission,
  getOverview,
  getUserProfile,
  grantPoints,
  listMissions,
  listRecentTransactions,
  listRedeemables,
  listTiers,
  missionPeriodKey,
  recordChatMessage,
  recordPlayMinutes,
  redeemItem,
  saveEconomy,
  setReferredBy,
  updateMission,
  updateTier,
  ensureUser,
  getMissionProgress,
  isMissionCompleted,
  dayKey,
} from "./store";

export function getRewardsDashboard(): RewardsDashboard {
  return {
    economy: getEconomy(),
    tiers: listTiers(),
    redeemables: listRedeemables(),
    missions: listMissions(),
    overview: getOverview(),
    recentTransactions: listRecentTransactions(25),
  };
}

export function updateEconomy(patch: Parameters<typeof saveEconomy>[0]) {
  return saveEconomy(patch);
}

export function addTier(input: Parameters<typeof createTier>[0]) {
  return createTier(input);
}

export function patchTier(id: string, patch: Parameters<typeof updateTier>[1]) {
  return updateTier(id, patch);
}

export function removeTier(id: string) {
  return deleteTier(id);
}

export function addRedeemable(input: Parameters<typeof createRedeemable>[0]) {
  return createRedeemable(input);
}

export function addMission(input: Parameters<typeof createMission>[0]) {
  return createMission(input);
}

export function patchMission(id: string, patch: Parameters<typeof updateMission>[1]) {
  return updateMission(id, patch);
}

export async function processRewardsEvent(
  userId: string,
  username: string,
  input: RewardsEventInput
): Promise<{ granted: number; missionsCompleted: string[] }> {
  ensureUser(userId, username);
  const economy = getEconomy();
  let granted = 0;
  const missionsCompleted: string[] = [];

  if (input.metric === "play_time" && input.amount) {
    const minutes = Math.min(input.amount, 5);
    recordPlayMinutes(userId, username, minutes);
    const hourPoints = Math.floor((minutes / 60) * economy.pointsPerHour * economy.xpMultiplier);
    if (hourPoints > 0) {
      const r = grantPoints({ userId, username, amount: hourPoints, reason: "Tiempo de juego", source: "play_time" });
      granted += r.transaction.amount;
    }
    const result = await completeMissionMetric(userId, username, "play_time", minutes);
    missionsCompleted.push(...result);
  }

  if (input.metric === "login") {
    const result = await handleDailyLogin(userId, username);
    granted += result.granted;
    missionsCompleted.push(...result.missionsCompleted);
  }

  if (input.metric === "chat") {
    recordChatMessage(userId);
    const result = await completeMissionMetric(userId, username, "chat", 1);
    missionsCompleted.push(...result);
  }

  if (input.metric === "invite") {
    const result = await completeMissionMetric(userId, username, "invite", 1);
    missionsCompleted.push(...result);
    const r = grantPoints({
      userId,
      username,
      amount: economy.referralBonus,
      reason: "Referido registrado",
      source: "referral",
    });
    granted += r.transaction.amount;
  }

  if (input.metric === "modpack_install") {
    const result = await completeMissionMetric(userId, username, "modpack_install", 1);
    missionsCompleted.push(...result);
  }

  if (input.metric === "event") {
    const r = grantPoints({
      userId,
      username,
      amount: economy.eventBonus,
      reason: String(input.metadata?.eventName ?? "Evento"),
      source: "event",
      metadata: input.metadata,
    });
    granted += r.transaction.amount;
    const result = await completeMissionMetric(userId, username, "event", 1);
    missionsCompleted.push(...result);
  }

  return { granted, missionsCompleted };
}

async function handleDailyLogin(userId: string, username: string) {
  const economy = getEconomy();
  let granted = 0;
  const missionsCompleted: string[] = [];
  const today = dayKey();

  const profile = ensureUser(userId, username);
  if (profile.lastLoginDate !== today) {
    const bonus = grantPoints({
      userId,
      username,
      amount: economy.dailyBonus,
      reason: "Bonus diario",
      source: "daily_bonus",
    });
    granted += bonus.transaction.amount;
    const db = (await import("@/lib/db/sqlite")).getSqliteDb();
    db.prepare("UPDATE rewards_users SET last_login_date = ?, last_daily_bonus = ? WHERE user_id = ?").run(
      today,
      new Date().toISOString(),
      userId
    );
  }

  const loginMissions = await completeMissionMetric(userId, username, "login", 1);
  missionsCompleted.push(...loginMissions);
  return { granted, missionsCompleted };
}

async function completeMissionMetric(
  userId: string,
  username: string,
  metric: MissionMetric,
  delta: number
): Promise<string[]> {
  const completed: string[] = [];
  const missions = listMissions().filter((m) => m.active && m.metric === metric);

  for (const mission of missions) {
    if (mission.expiresAt && Date.parse(mission.expiresAt) < Date.now()) continue;
    const { justCompleted } = advanceMissionProgress(userId, mission, delta);
    if (justCompleted) {
      bumpMissionCompletions(mission.id);
      const r = grantPoints({
        userId,
        username,
        amount: mission.rewardPoints,
        reason: `Misión: ${mission.title}`,
        source: "mission",
        metadata: { missionId: mission.id },
      });
      completed.push(mission.id);
      emitSystemEvent("liveops.alert", {
        action: "mission_completed",
        userId,
        username,
        mission: mission.title,
        points: r.transaction.amount,
      });
    }
  }
  return completed;
}

export function getUserRewardsState(userId: string): {
  profile: UserRewardsProfile | null;
  missions: MissionProgressView[];
  redeemables: ReturnType<typeof listRedeemables>;
} | null {
  const profile = getUserProfile(userId);
  if (!profile) return null;

  const missions = listMissions()
    .filter((m) => m.active)
    .map((m) => {
      const periodKey = missionPeriodKey(m.type);
      const progress = getMissionProgress(userId, m.id, periodKey);
      const completed = isMissionCompleted(userId, m.id, periodKey);
      return {
        missionId: m.id,
        title: m.title,
        description: m.description,
        type: m.type,
        metric: m.metric,
        target: m.target,
        rewardPoints: m.rewardPoints,
        progress: completed ? m.target : progress,
        completed,
        expiresAt: m.expiresAt,
      };
    });

  return { profile, missions, redeemables: listRedeemables().filter((r) => r.active) };
}

export function applyReferralCode(userId: string, username: string, code: string): boolean {
  const referrerId = setReferredBy(userId, code);
  if (!referrerId) return false;
  const referrer = getUserProfile(referrerId);
  if (!referrer) return false;
  void processRewardsEvent(referrerId, referrer.username, { metric: "invite" });
  return true;
}

export function userRedeem(userId: string, username: string, redeemableId: string) {
  const result = redeemItem(userId, username, redeemableId);
  if (result.ok) {
    emitSystemEvent("liveops.alert", { action: "reward_redeemed", userId, username, redeemableId });
  }
  return result;
}

export function adminGrantPoints(
  userId: string,
  username: string,
  amount: number,
  reason: string
) {
  return grantPoints({ userId, username, amount, reason, source: "admin" });
}

export { grantPoints };
