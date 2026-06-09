import type { LauncherNotificationPayload } from "../types/protocol";
import type { LauncherAuthHeaders } from "../types/launcher-auth";
import { authHeaders } from "./launcher-auth";

export type PollNotificationsResult = {
  notifications: LauncherNotificationPayload[];
  unauthorized: boolean;
  error: boolean;
};

export async function pollLauncherNotifications(
  apiBase: string,
  auth: LauncherAuthHeaders
): Promise<PollNotificationsResult> {
  try {
    const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/notifications/outbox`, {
      cache: "no-store",
      headers: authHeaders(auth),
    });
    if (res.status === 401) {
      return { notifications: [], unauthorized: true, error: false };
    }
    if (!res.ok) {
      return { notifications: [], unauthorized: false, error: true };
    }
    const data = (await res.json()) as { notifications?: LauncherNotificationPayload[] };
    return { notifications: data.notifications ?? [], unauthorized: false, error: false };
  } catch {
    return { notifications: [], unauthorized: false, error: true };
  }
}

export async function ackLauncherNotifications(
  apiBase: string,
  auth: LauncherAuthHeaders,
  ids: string[]
): Promise<void> {
  if (!ids.length) return;
  try {
    await fetch(`${apiBase.replace(/\/$/, "")}/api/notifications/ack`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(auth) },
      body: JSON.stringify({ ids }),
    });
  } catch {
    /* ignore */
  }
}

export type { LauncherNotificationPayload, NotificationDisplay, NotificationStyle } from "../types/protocol";
