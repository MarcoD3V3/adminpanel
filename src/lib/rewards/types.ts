import type { Mission, MissionMetric, MissionType } from "@/types/features";

export type RewardEconomy = {
  pointsPerHour: number;
  dailyBonus: number;
  referralBonus: number;
  eventBonus: number;
  xpMultiplier: number;
  updatedAt: string;
};

export type RewardTierRecord = {
  id: string;
  name: string;
  pointsRequired: number;
  perks: string[];
  sortOrder: number;
  members: number;
  createdAt: string;
  updatedAt: string;
};

export type RedeemableRecord = {
  id: string;
  name: string;
  description: string;
  cost: number;
  category: "cosmetic" | "modpack" | "badge" | "perk";
  active: boolean;
  stock?: number;
  redemptions: number;
  createdAt: string;
  updatedAt: string;
};

export type MissionRecord = Mission & { createdAt: string; updatedAt: string };

export type UserRewardsProfile = {
  userId: string;
  username: string;
  points: number;
  lifetimePoints: number;
  tierId?: string;
  tierName?: string;
  referralCode: string;
  referredBy?: string;
  lastDailyBonus?: string;
  lastLoginDate?: string;
  updatedAt: string;
};

export type PointTransaction = {
  id: string;
  userId: string;
  username: string;
  amount: number;
  balanceAfter: number;
  reason: string;
  source: string;
  createdAt: string;
};

export type MissionProgressView = {
  missionId: string;
  title: string;
  description: string;
  type: MissionType;
  metric: MissionMetric;
  target: number;
  rewardPoints: number;
  progress: number;
  completed: boolean;
  expiresAt?: string;
};

export type RewardsOverview = {
  totalUsers: number;
  totalPointsAwarded: number;
  redemptionsToday: number;
  missionsCompletedToday: number;
  topTierName: string;
};

export type RewardsDashboard = {
  economy: RewardEconomy;
  tiers: RewardTierRecord[];
  redeemables: RedeemableRecord[];
  missions: MissionRecord[];
  overview: RewardsOverview;
  recentTransactions: PointTransaction[];
};

export type GrantPointsInput = {
  userId: string;
  username: string;
  amount: number;
  reason: string;
  source: string;
  metadata?: Record<string, unknown>;
};

export type RewardsEventInput = {
  metric: MissionMetric | "referral" | "event" | "play_time";
  amount?: number;
  metadata?: Record<string, unknown>;
};
