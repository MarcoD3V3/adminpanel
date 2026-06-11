import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LauncherAuthStore } from "./types";

const AUTH_FILE = path.join(process.cwd(), "data", "launcher-auth.json");

const EMPTY: LauncherAuthStore = { activationTokens: [], sessions: [], users: [] };

async function readStore(): Promise<LauncherAuthStore> {
  try {
    const raw = await readFile(AUTH_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<LauncherAuthStore>;
    return {
      activationTokens: Array.isArray(parsed.activationTokens) ? parsed.activationTokens : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      users: Array.isArray(parsed.users) ? parsed.users : [],
      auditLog: Array.isArray(parsed.auditLog) ? parsed.auditLog : undefined,
      testerModeEnabled: parsed.testerModeEnabled === true,
    };
  } catch {
    return { ...EMPTY };
  }
}

async function writeStore(store: LauncherAuthStore): Promise<void> {
  await mkdir(path.dirname(AUTH_FILE), { recursive: true });
  await writeFile(AUTH_FILE, JSON.stringify(store, null, 2), "utf-8");
}

export async function loadAuthStore(): Promise<LauncherAuthStore> {
  return readStore();
}

export async function saveAuthStore(store: LauncherAuthStore): Promise<void> {
  await writeStore(store);
}

let mutationChain: Promise<unknown> = Promise.resolve();

export async function mutateAuthStore(
  fn: (store: LauncherAuthStore) => LauncherAuthStore | void
): Promise<LauncherAuthStore> {
  const run = mutationChain.then(async () => {
    const store = await readStore();
    const result = fn(store);
    const next = (result ?? store) as LauncherAuthStore;
    await writeStore(next);
    return next;
  });
  mutationChain = run.catch(() => undefined);
  return run;
}
