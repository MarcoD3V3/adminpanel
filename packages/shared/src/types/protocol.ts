/** Protocolo admin ↔ launcher (WebSocket + REST outbox) */

export type NotificationStyle = "info" | "warning" | "success" | "error" | "alert" | "update";

export type NotificationDisplay = "toast" | "alert" | "banner";

export type RemoteCommand =
  | {
      type: "notification";
      id?: string;
      title: string;
      message: string;
      style?: NotificationStyle;
      display?: NotificationDisplay;
    }
  | { type: "force_update"; version: string }
  | { type: "restart" }
  | { type: "kill_game" }
  | { type: "maintenance"; enabled: boolean }
  | { type: "broadcast_event"; eventName: string; data: unknown }
  | { type: "sync_config"; config: Record<string, unknown> }
  | { type: "sync_hub_layout"; layout: unknown };

export type LauncherEvent =
  | { type: "heartbeat"; launcherId: string; ramMb: number; cpuPercent: number; status: string }
  | { type: "game_launch"; version: string }
  | { type: "chat_message"; channel: "global" | "friends"; content: string }
  | { type: "login"; userId: string }
  | { type: "ready"; launcherId: string; version: string };

export type WsEnvelope =
  | { channel: "command"; payload: RemoteCommand }
  | { channel: "event"; payload: LauncherEvent }
  | { channel: "ping" | "pong"; ts: number };

export type LauncherNotificationPayload = {
  id: string;
  title: string;
  message: string;
  style: NotificationStyle;
  display: NotificationDisplay;
  createdAt: string;
};
