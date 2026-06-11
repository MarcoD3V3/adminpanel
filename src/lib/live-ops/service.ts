import { randomBytes } from "node:crypto";
import type { RemoteCommand } from "@craftlauncher/shared";
import type { LiveOpsSession } from "@/types";
import { resolveGeo, resolveHealth } from "./geo";
import {
  loadLiveOpsStore,
  mutateLiveOpsStore,
  type LivePresenceRecord,
  type PendingLiveCommand,
} from "./store";

const PRESENCE_TTL_MS = 45_000;
const MAX_COMMANDS = 200;

function cmdId(): string {
  return `lcmd_${randomBytes(6).toString("hex")}`;
}

function prunePresence(records: LivePresenceRecord[]): LivePresenceRecord[] {
  const cutoff = Date.now() - PRESENCE_TTL_MS;
  return records.filter((r) => Date.parse(r.lastSeenAt) >= cutoff);
}

export type PresenceHeartbeatInput = {
  sessionId: string;
  userId?: string;
  username: string;
  displayName?: string;
  premium: boolean;
  tester?: boolean;
  deviceId: string;
  status: LivePresenceRecord["status"];
  launcherVersion: string;
  minecraftVersion?: string;
  os: string;
  ramUsage: number;
  cpuUsage: number;
  timezone?: string;
  locale?: string;
  ip?: string;
};

export async function upsertPresence(input: PresenceHeartbeatInput): Promise<LivePresenceRecord> {
  const geo = await resolveGeo({
    ip: input.ip,
    timezone: input.timezone,
    locale: input.locale,
  });
  const now = new Date().toISOString();
  const health = resolveHealth(input.ramUsage, input.cpuUsage);

  let record: LivePresenceRecord | null = null;
  await mutateLiveOpsStore((store) => {
    store.presence = prunePresence(store.presence);
    const existing = store.presence.find((p) => p.deviceId === input.deviceId);
    record = {
      id: input.sessionId,
      userId: input.userId,
      username: input.username,
      displayName: input.displayName,
      premium: input.premium,
      tester: input.tester,
      deviceId: input.deviceId,
      status: input.status,
      launcherVersion: input.launcherVersion,
      minecraftVersion: input.minecraftVersion,
      os: input.os,
      ip: input.ip ?? "—",
      ramUsage: Math.round(input.ramUsage),
      cpuUsage: Math.round(input.cpuUsage),
      country: geo.country,
      countryCode: geo.countryCode,
      city: geo.city,
      lat: geo.lat,
      lng: geo.lng,
      connectedAt: existing?.connectedAt ?? now,
      lastSeenAt: now,
      launcherId: input.deviceId,
      health,
    };
    if (existing) {
      const idx = store.presence.indexOf(existing);
      store.presence[idx] = record;
    } else {
      store.presence.push(record);
    }
  });

  return record!;
}

export async function listLiveSessions(): Promise<LiveOpsSession[]> {
  return listPresenceRecords().then((records) =>
    records.map((p) => ({
      id: p.id,
      userId: p.userId ?? p.deviceId,
      username: p.username,
      status: p.status,
      premium: p.premium,
      tester: p.tester,
      country: p.country,
      countryCode: p.countryCode,
      city: p.city,
      lat: p.lat,
      lng: p.lng,
      launcherVersion: p.launcherVersion,
      minecraftVersion: p.minecraftVersion,
      os: p.os,
      ip: p.ip,
      ramUsage: p.ramUsage,
      cpuUsage: p.cpuUsage,
      health: p.health,
      connectedAt: p.connectedAt,
      lastSeenAt: p.lastSeenAt,
      deviceId: p.deviceId,
      launcherId: p.launcherId,
    }))
  );
}

export async function listPresenceRecords(): Promise<LivePresenceRecord[]> {
  const store = loadLiveOpsStore();
  return prunePresence(store.presence);
}

export async function enqueueCommand(
  deviceId: string,
  command: RemoteCommand,
  sessionId?: string
): Promise<PendingLiveCommand> {
  const entry: PendingLiveCommand = {
    id: cmdId(),
    deviceId,
    sessionId,
    command,
    createdAt: new Date().toISOString(),
  };
  await mutateLiveOpsStore((store) => {
    store.commands.unshift(entry);
    if (store.commands.length > MAX_COMMANDS) {
      store.commands = store.commands.slice(0, MAX_COMMANDS);
    }
  });
  return entry;
}

export async function pollCommandsForDevice(deviceId: string): Promise<RemoteCommand[]> {
  const collected: RemoteCommand[] = [];
  await mutateLiveOpsStore((store) => {
    const pending = store.commands.filter((c) => c.deviceId === deviceId);
    for (const cmd of pending) {
      collected.push(cmd.command);
    }
    store.commands = store.commands.filter((c) => c.deviceId !== deviceId);
  });
  return collected;
}

export async function removePresenceBySession(sessionId: string): Promise<boolean> {
  let removed = false;
  await mutateLiveOpsStore((store) => {
    const before = store.presence.length;
    store.presence = store.presence.filter((p) => p.id !== sessionId);
    removed = store.presence.length < before;
  });
  return removed;
}

export async function removePresenceByDevice(deviceId: string): Promise<boolean> {
  let removed = false;
  await mutateLiveOpsStore((store) => {
    const before = store.presence.length;
    store.presence = store.presence.filter((p) => p.deviceId !== deviceId);
    removed = store.presence.length < before;
  });
  return removed;
}

export function findPresenceBySessionId(sessionId: string): LivePresenceRecord | null {
  const store = loadLiveOpsStore();
  return prunePresence(store.presence).find((p) => p.id === sessionId) ?? null;
}
