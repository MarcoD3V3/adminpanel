/* Tipos para funcionalidades avanzadas del ecosistema */

export type ScheduleStatus = "pending" | "running" | "completed" | "cancelled";
export type ScheduleAction =
  | "maintenance"
  | "notification"
  | "force_update"
  | "broadcast"
  | "double_xp"
  | "chat_event";

export interface ScheduledEvent {
  id: string;
  name: string;
  action: ScheduleAction;
  scheduledAt: string;
  target: "all" | "online" | "premium";
  payload: Record<string, unknown>;
  status: ScheduleStatus;
  recurring?: "once" | "daily" | "weekly";
}

export type MissionType = "daily" | "weekly" | "special";
export type MissionMetric = "play_time" | "login" | "invite" | "chat" | "modpack_install" | "event";

export interface Mission {
  id: string;
  title: string;
  description: string;
  type: MissionType;
  metric: MissionMetric;
  target: number;
  rewardPoints: number;
  active: boolean;
  completions: number;
  expiresAt?: string;
}

export interface Modpack {
  id: string;
  name: string;
  description: string;
  mcVersion: string;
  loader: "forge" | "fabric" | "quilt" | "vanilla";
  /** ID del proyecto en CurseForge para instalación one-click */
  curseForgeId?: number;
  curseForgeSlug?: string;
  catalogKind?: "modpack" | "mod";
  modCount: number;
  downloads: number;
  sizeMb: number;
  enabled: boolean;
  premiumOnly: boolean;
  author: string;
  updatedAt: string;
}

export type AlertSeverity = "low" | "medium" | "high" | "critical";

export interface SecurityAlert {
  id: string;
  username: string;
  userId: string;
  type: "cheat_client" | "modified_jar" | "hwid_mismatch" | "suspicious_mod" | "injection";
  severity: AlertSeverity;
  detail: string;
  detectedAt: string;
  resolved: boolean;
}

export interface SecurityRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  action: "flag" | "kick" | "ban" | "notify_admin";
}

export interface Experiment {
  id: string;
  name: string;
  key: string;
  description: string;
  status: "draft" | "running" | "paused" | "completed";
  variantA: string;
  variantB: string;
  rolloutPercent: number;
  metric: "retention" | "crash_rate" | "session_time" | "conversion";
  resultA: number;
  resultB: number;
  winner?: "A" | "B" | null;
  startedAt?: string;
}

export interface Integration {
  id: string;
  name: string;
  type: "discord" | "telegram" | "slack" | "custom";
  url: string;
  events: string[];
  active: boolean;
  lastTriggered?: string;
  successRate: number;
}

export interface SeasonTheme {
  id: string;
  name: string;
  accentColor: string;
  backgroundUrl?: string;
  active: boolean;
  startDate: string;
  endDate: string;
}

export interface SocialProfile {
  id: string;
  userId: string;
  username: string;
  bio: string;
  status: "online" | "playing" | "away" | "offline";
  premium: boolean;
  rank: string;
  playTimeHours: number;
  achievements: number;
  friends: number;
  badges: string[];
  visibility: "public" | "friends" | "private";
}

export interface ChatReport {
  id: string;
  messageId: string;
  reporterName: string;
  reportedName: string;
  reason: string;
  status: "pending" | "reviewed" | "action_taken";
  timestamp: string;
}

export interface ChatModStats {
  messagesFiltered: number;
  spamBlocked: number;
  usersMuted: number;
  autoActionsToday: number;
}
