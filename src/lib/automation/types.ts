import type { IntegrationEventType, ScheduledEvent } from "@/types/features";

export type AutomationTriggerType =
  | IntegrationEventType
  | "launcher.version_below"
  | "chat.flags_threshold"
  | "user.premium"
  | "cron";

export type AutomationActionType =
  | "ban_user_temp"
  | "revoke_user"
  | "notify_launcher"
  | "notify_admin"
  | "dispatch_integration"
  | "create_notification"
  | "flag_for_review"
  | "export_data_backup"
  | "grant_points"
  | "enable_maintenance"
  | "run_liveops_message";

export type AutomationRuleRecord = {
  id: string;
  name: string;
  triggerType: AutomationTriggerType;
  triggerConfig: Record<string, unknown>;
  actionType: AutomationActionType;
  actionConfig: Record<string, unknown>;
  enabled: boolean;
  lastRun?: string;
  runCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AutomationRunRecord = {
  id: string;
  ruleId: string;
  ruleName: string;
  triggerEvent: string;
  success: boolean;
  detail: string;
  createdAt: string;
};

export type ModerationSettings = {
  wordFilter: boolean;
  spamDetect: boolean;
  blockLinks: boolean;
  slowMode: boolean;
  blacklist: string[];
  flaggedAction: "mute_1h" | "mute_24h" | "ban" | "review";
  reportAction: "notify" | "hide" | "ban";
  updatedAt: string;
};

export type AutomationScheduledJob = ScheduledEvent & {
  lastRunAt?: string;
  nextRunAt?: string;
};

export type AutomationOverview = {
  activeRules: number;
  runsToday: number;
  pendingJobs: number;
  tempBans: number;
};
