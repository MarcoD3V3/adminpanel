import { generateId } from "./crypto";
import { mutateAuthStore } from "./store";
import type { AuditLogEntry } from "./types";

const MAX_AUDIT = 500;

export async function appendAuditLog(
  action: AuditLogEntry["action"],
  ipHint?: string,
  meta?: string
): Promise<void> {
  const entry: AuditLogEntry = {
    id: generateId("aud"),
    action,
    at: new Date().toISOString(),
    ipHint,
    meta: meta?.slice(0, 200),
  };

  await mutateAuthStore((store) => {
    if (!store.auditLog) store.auditLog = [];
    store.auditLog.unshift(entry);
    if (store.auditLog.length > MAX_AUDIT) {
      store.auditLog = store.auditLog.slice(0, MAX_AUDIT);
    }
  });
}

export async function listAuditLog(limit = 50): Promise<AuditLogEntry[]> {
  const { loadAuthStore } = await import("./store");
  const store = await loadAuthStore();
  return (store.auditLog ?? []).slice(0, Math.min(limit, MAX_AUDIT));
}
