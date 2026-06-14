import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "node:path";
import { dataPath } from "@/lib/data-dir";

/** Tiempo sin heartbeat antes de liberar el lock (ms). */
export const HUB_EDIT_LOCK_LEASE_MS = 90_000;

export type HubEditLockRecord = {
  editorId: string;
  holderLabel: string;
  acquiredAt: string;
  lastHeartbeat: string;
  expiresAt: string;
};

const lockFilePath = () => dataPath("hub-layout-edit-lock.json");

function isLockRecord(value: unknown): value is HubEditLockRecord {
  if (!value || typeof value !== "object") return false;
  const v = value as HubEditLockRecord;
  return (
    typeof v.editorId === "string" &&
    typeof v.holderLabel === "string" &&
    typeof v.acquiredAt === "string" &&
    typeof v.lastHeartbeat === "string" &&
    typeof v.expiresAt === "string"
  );
}

export function isHubEditLockActive(lock: HubEditLockRecord | null, now = Date.now()): boolean {
  if (!lock) return false;
  const exp = Date.parse(lock.expiresAt);
  return Number.isFinite(exp) && exp > now;
}

export async function readHubEditLock(): Promise<HubEditLockRecord | null> {
  try {
    const raw = await readFile(lockFilePath(), "utf-8");
    if (!raw.trim()) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isLockRecord(parsed)) return null;
    if (!isHubEditLockActive(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeHubEditLock(lock: HubEditLockRecord | null): Promise<void> {
  const LOCK_FILE = lockFilePath();
  await mkdir(path.dirname(LOCK_FILE), { recursive: true });
  if (!lock) {
    try {
      await writeFile(LOCK_FILE, "", "utf-8");
    } catch {
      /* ignore */
    }
    return;
  }
  const tmp = `${LOCK_FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(lock, null, 2), "utf-8");
  await rename(tmp, LOCK_FILE);
}

export type HubEditLockAcquireResult =
  | { ok: true; lock: HubEditLockRecord; isOwner: true }
  | { ok: false; lock: HubEditLockRecord; isOwner: false };

export async function acquireOrRefreshHubEditLock(
  editorId: string,
  holderLabel: string
): Promise<HubEditLockAcquireResult> {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const existing = await readHubEditLock();

  if (existing && existing.editorId !== editorId) {
    return { ok: false, lock: existing, isOwner: false };
  }

  const lock: HubEditLockRecord = {
    editorId,
    holderLabel: holderLabel.trim().slice(0, 64) || "Editor",
    acquiredAt: existing?.acquiredAt ?? nowIso,
    lastHeartbeat: nowIso,
    expiresAt: new Date(now + HUB_EDIT_LOCK_LEASE_MS).toISOString(),
  };
  await writeHubEditLock(lock);
  return { ok: true, lock, isOwner: true };
}

export async function releaseHubEditLock(editorId: string): Promise<boolean> {
  const existing = await readHubEditLock();
  if (!existing || existing.editorId !== editorId) return false;
  await writeHubEditLock(null);
  return true;
}
