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

export type SecurityDetectionType =
  | "admin_cookie_tamper"
  | "admin_session_hijack"
  | "admin_csrf_origin"
  | "admin_brute_force"
  | "admin_xss_attempt"
  | "admin_sql_injection"
  | "admin_path_traversal"
  | "admin_unauthorized_api"
  | "admin_rate_limit"
  | "admin_privilege_escalation"
  | "admin_hub_lock_bypass"
  | "admin_data_tamper"
  | "admin_header_spoof"
  | "admin_mass_scrape"
  | "admin_token_replay"
  | "launcher_cheat_client"
  | "launcher_modified_jar"
  | "launcher_hwid_mismatch"
  | "launcher_suspicious_mod"
  | "launcher_code_injection"
  | "launcher_debugger_attached"
  | "launcher_ssl_pin_bypass"
  | "launcher_token_theft"
  | "launcher_heartbeat_anomaly"
  | "launcher_file_tamper"
  | "launcher_env_tamper"
  | "launcher_proxy_mitm"
  | "launcher_bot_automation"
  | "launcher_unsigned_binary"
  | "launcher_login_brute";

export type SecuritySource = "admin" | "launcher";

export interface SecurityAlert {
  id: string;
  username: string;
  userId: string;
  type: SecurityDetectionType;
  source: SecuritySource;
  severity: AlertSeverity;
  detail: string;
  detectedAt: string;
  resolved: boolean;
  ip?: string;
  deviceId?: string;
  metadata?: Record<string, unknown>;
}

export interface SecurityRule {
  id: string;
  detectionType: SecurityDetectionType;
  name: string;
  description: string;
  enabled: boolean;
  action: "flag" | "kick" | "ban" | "notify_admin";
  source: SecuritySource;
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
  description?: string;
  config?: IntegrationConfig;
  totalDeliveries?: number;
  failedDeliveries?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type IntegrationConfig = {
  telegramChatId?: string;
  discordUsername?: string;
  discordAvatarUrl?: string;
  secretHeaderName?: string;
  secretHeaderValue?: string;
  retryOnFail?: boolean;
  customTemplate?: string;
};

export type IntegrationEventType =
  | "user.ban"
  | "user.register"
  | "user.login"
  | "security.critical"
  | "security.high"
  | "security.alert"
  | "liveops.alert"
  | "launcher.crash"
  | "launcher.online"
  | "maintenance.start"
  | "maintenance.end"
  | "experiment.completed"
  | "experiment.started"
  | "modpack.publish"
  | "chat.flag"
  | "notification.sent"
  | "hub.published"
  | "token.created"
  | "admin.login"
  | "integration.test";

export interface IntegrationDelivery {
  id: string;
  integrationId: string;
  integrationName: string;
  event: IntegrationEventType | string;
  success: boolean;
  statusCode?: number;
  error?: string;
  durationMs: number;
  payloadPreview: string;
  createdAt: string;
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
