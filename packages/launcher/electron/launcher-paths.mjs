import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const BOOTSTRAP_FILE = "launcher-bootstrap.json";

export function electronUserData() {
  if (process.env.CRAFTLAUNCHER_USER_DATA) {
    return process.env.CRAFTLAUNCHER_USER_DATA;
  }
  try {
    const { app } = require("electron");
    return app?.getPath?.("userData") ?? null;
  } catch {
    return null;
  }
}

export function resolveUserData(override) {
  const dir = override ?? electronUserData();
  if (!dir) throw new Error("No se pudo resolver la carpeta userData del launcher");
  return dir;
}

export function defaultDataDir() {
  return path.join(os.homedir(), ".craftlauncher");
}

function bootstrapPath() {
  const userData = electronUserData();
  if (userData) return path.join(userData, BOOTSTRAP_FILE);
  return path.join(defaultDataDir(), BOOTSTRAP_FILE);
}

export function readBootstrap() {
  if (process.env.CRAFTLAUNCHER_DATA_DIR) {
    return { dataDir: process.env.CRAFTLAUNCHER_DATA_DIR };
  }
  try {
    const raw = fs.readFileSync(bootstrapPath(), "utf-8");
    return JSON.parse(raw);
  } catch {
    return { dataDir: defaultDataDir() };
  }
}
export function writeBootstrap(data) {
  fs.mkdirSync(path.dirname(bootstrapPath()), { recursive: true });
  fs.writeFileSync(bootstrapPath(), JSON.stringify(data, null, 2), "utf-8");
}

export function resolveDataDir(override) {
  const dir = path.resolve(override || readBootstrap().dataDir || defaultDataDir());
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function instancesRoot(dataDir) {
  return path.join(dataDir, "instances");
}

export function instanceDir(dataDir, instanceId) {
  return path.join(instancesRoot(dataDir), instanceId);
}

export function instanceGameRoot(dataDir, instanceId) {
  return path.join(instanceDir(dataDir, instanceId), "game");
}

export function instanceModsDir(dataDir, instanceId) {
  return path.join(instanceGameRoot(dataDir, instanceId), "mods");
}

export function instanceResourcePacksDir(dataDir, instanceId) {
  return path.join(instanceGameRoot(dataDir, instanceId), "resourcepacks");
}

export function settingsPath(dataDir) {
  return path.join(dataDir, "settings.json");
}

export function hubLayoutCachePath(dataDir) {
  return path.join(dataDir, "hub-layout.json");
}

export function instanceMetaPath(dataDir, instanceId) {
  return path.join(instanceDir(dataDir, instanceId), "instance.json");
}

export function ensureInstanceDirs(dataDir, instanceId) {
  const dirs = [
    instanceDir(dataDir, instanceId),
    instanceGameRoot(dataDir, instanceId),
    instanceModsDir(dataDir, instanceId),
    path.join(instanceGameRoot(dataDir, instanceId), "config"),
    path.join(instanceGameRoot(dataDir, instanceId), "saves"),
    path.join(instanceGameRoot(dataDir, instanceId), "resourcepacks"),
  ];
  for (const d of dirs) fs.mkdirSync(d, { recursive: true });
}
