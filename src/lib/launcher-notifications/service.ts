import { randomBytes } from "node:crypto";
import type { NotificationDisplay, NotificationStyle } from "@craftlauncher/shared";
import { mutateNotificationStore, loadNotificationStore, type NotificationTarget, type StoredNotification } from "./store";

function id(): string {
  return `ntf_${randomBytes(8).toString("hex")}`;
}

export type CreateNotificationInput = {
  title: string;
  message: string;
  style: NotificationStyle;
  display: NotificationDisplay;
  target: NotificationTarget;
  targetDevices?: string[];
};

export async function createNotification(input: CreateNotificationInput): Promise<StoredNotification> {
  const record: StoredNotification = {
    id: id(),
    title: input.title.trim(),
    message: input.message.trim(),
    style: input.style,
    display: input.display,
    target: input.target,
    targetDevices: input.targetDevices,
    createdAt: new Date().toISOString(),
    deliveredTo: [],
  };

  await mutateNotificationStore((store) => {
    store.items.unshift(record);
  });

  return record;
}

export async function listNotifications(limit = 50): Promise<StoredNotification[]> {
  const store = await loadNotificationStore();
  return store.items.slice(0, limit);
}

function matchesTarget(item: StoredNotification, deviceId: string): boolean {
  if (item.target === "specific") {
    return item.targetDevices?.includes(deviceId) ?? false;
  }
  return true;
}

export async function pollNotificationsForDevice(deviceId: string) {
  const store = await loadNotificationStore();
  return store.items
    .filter((n) => matchesTarget(n, deviceId) && !n.deliveredTo.includes(deviceId))
    .map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      style: n.style,
      display: n.display,
      createdAt: n.createdAt,
    }));
}

export async function ackNotifications(deviceId: string, ids: string[]): Promise<number> {
  let count = 0;
  await mutateNotificationStore((store) => {
    for (const item of store.items) {
      if (!ids.includes(item.id)) continue;
      if (!item.deliveredTo.includes(deviceId)) {
        item.deliveredTo.push(deviceId);
        count += 1;
      }
    }
  });
  return count;
}
