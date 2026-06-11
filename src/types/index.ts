export type UserStatus = "online" | "offline" | "playing" | "banned";

export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  status: UserStatus;
  premium: boolean;
  lastSeen: string;
  launcherVersion: string;
  playTimeHours: number;
}

export type LauncherStatus = "online" | "offline" | "updating" | "launching";

export interface LauncherInstance {
  id: string;
  userId: string;
  username: string;
  status: LauncherStatus;
  version: string;
  ip: string;
  os: string;
  ramUsage: number;
  cpuUsage: number;
  connectedAt: string;
  minecraftVersion?: string;
}

export type NotificationTarget = "all" | "online" | "premium" | "specific";

export type NotificationDisplay = "toast" | "alert" | "banner";

export interface Notification {
  id: string;
  title: string;
  message: string;
  target: NotificationTarget;
  targetUsers?: string[];
  type: "info" | "warning" | "success" | "error" | "alert" | "update";
  display: NotificationDisplay;
  createdAt: string;
  sent: boolean;
  readCount: number;
}

export type RemoteEventType =
  | "force_update"
  | "restart_launcher"
  | "kill_game"
  | "send_message"
  | "open_url"
  | "maintenance_mode"
  | "broadcast_event"
  | "sync_config";

export interface RemoteEvent {
  id: string;
  type: RemoteEventType;
  payload: Record<string, unknown>;
  target: "all" | "specific" | "online";
  targetIds?: string[];
  status: "pending" | "executing" | "completed" | "failed";
  createdAt: string;
  executedCount: number;
}

export type ChatChannel = "global" | "friends";

export interface ChatMessage {
  id: string;
  channel: ChatChannel;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
  flagged: boolean;
}

export interface DashboardStats {
  totalUsers: number;
  onlineUsers: number;
  activeLaunchers: number;
  premiumUsers: number;
  messagesToday: number;
  pendingEvents: number;
}

export interface ActivityItem {
  id: string;
  type: "login" | "launch" | "chat" | "event" | "notification";
  message: string;
  timestamp: string;
  user?: string;
}

export interface FeatureFlag {
  id: string;
  name: string;
  key: string;
  description: string;
  enabled: boolean;
  rollout: number;
  audience: "all" | "premium" | "beta";
}

export interface ContentBanner {
  id: string;
  title: string;
  subtitle: string;
  imageUrl?: string;
  cta: string;
  active: boolean;
  position: "hero" | "sidebar" | "popup";
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  enabled: boolean;
  lastRun?: string;
}

export interface RewardTier {
  id: string;
  name: string;
  pointsRequired: number;
  perks: string[];
  members: number;
}

export interface McVersion {
  id: string;
  version: string;
  type: "release" | "snapshot" | "modded";
  enabled: boolean;
  downloads: number;
  javaRequired: string;
}

export interface AnalyticsPoint {
  label: string;
  value: number;
}

export type LiveOpsHealth = "healthy" | "warning" | "critical";

export interface LiveOpsSession {
  id: string;
  userId: string;
  username: string;
  status: "online" | "playing" | "launching" | "updating" | "idle";
  premium: boolean;
  tester?: boolean;
  country: string;
  countryCode: string;
  city: string;
  lat: number;
  lng: number;
  launcherVersion: string;
  minecraftVersion?: string;
  os: string;
  ip: string;
  ramUsage: number;
  cpuUsage: number;
  health: LiveOpsHealth;
  connectedAt: string;
  lastSeenAt?: string;
  deviceId?: string;
  launcherId: string;
}

export * from "./features";
export * from "./hub-builder";
