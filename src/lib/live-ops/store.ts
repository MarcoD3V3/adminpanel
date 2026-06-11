import fs from "node:fs";
import path from "node:path";
import type { RemoteCommand } from "@craftlauncher/shared";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "live-ops.json");

export type LivePresenceRecord = {
  id: string;
  userId?: string;
  username: string;
  displayName?: string;
  premium: boolean;
  tester?: boolean;
  deviceId: string;
  status: "online" | "playing" | "launching" | "updating" | "idle";
  launcherVersion: string;
  minecraftVersion?: string;
  os: string;
  ip: string;
  ramUsage: number;
  cpuUsage: number;
  country: string;
  countryCode: string;
  city: string;
  lat: number;
  lng: number;
  connectedAt: string;
  lastSeenAt: string;
  launcherId: string;
  health: "healthy" | "warning" | "critical";
};

export type PendingLiveCommand = {
  id: string;
  deviceId: string;
  sessionId?: string;
  command: RemoteCommand;
  createdAt: string;
};

type LiveOpsStore = {
  presence: LivePresenceRecord[];
  commands: PendingLiveCommand[];
};

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function defaultStore(): LiveOpsStore {
  return { presence: [], commands: [] };
}

export function loadLiveOpsStore(): LiveOpsStore {
  ensureDir();
  try {
    const raw = fs.readFileSync(STORE_FILE, "utf-8");
    const parsed = JSON.parse(raw) as LiveOpsStore;
    if (Array.isArray(parsed.presence) && Array.isArray(parsed.commands)) return parsed;
  } catch {
    /* fresh */
  }
  return defaultStore();
}

let writeQueue: Promise<void> = Promise.resolve();

export function mutateLiveOpsStore(mutator: (store: LiveOpsStore) => void): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    const store = loadLiveOpsStore();
    mutator(store);
    ensureDir();
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), "utf-8");
  });
  return writeQueue;
}
