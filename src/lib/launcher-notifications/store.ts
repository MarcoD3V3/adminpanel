import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { NotificationDisplay, NotificationStyle } from "@craftlauncher/shared";
import { dataPath } from "@/lib/data-dir";

export type NotificationTarget = "all" | "online" | "premium" | "specific";

export type StoredNotification = {
  id: string;
  title: string;
  message: string;
  style: NotificationStyle;
  display: NotificationDisplay;
  target: NotificationTarget;
  targetDevices?: string[];
  createdAt: string;
  deliveredTo: string[];
};

export type NotificationStore = {
  items: StoredNotification[];
};

const FILE = dataPath("launcher-notifications.json");
const EMPTY: NotificationStore = { items: [] };
const MAX_ITEMS = 200;

async function readStore(): Promise<NotificationStore> {
  try {
    const raw = await readFile(FILE, "utf-8");
    const parsed = JSON.parse(raw) as NotificationStore;
    return parsed.items ? parsed : { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
}

async function writeStore(store: NotificationStore): Promise<void> {
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(store, null, 2), "utf-8");
}

export async function mutateNotificationStore(
  fn: (store: NotificationStore) => NotificationStore | void
): Promise<NotificationStore> {
  const store = await readStore();
  const result = fn(store);
  const next = (result ?? store) as NotificationStore;
  if (next.items.length > MAX_ITEMS) next.items = next.items.slice(0, MAX_ITEMS);
  await writeStore(next);
  return next;
}

export async function loadNotificationStore(): Promise<NotificationStore> {
  return readStore();
}
