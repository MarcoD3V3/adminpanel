import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const PANEL_BASE = process.env.CRAFTLAUNCHER_PANEL_URL || "http://localhost:3000";
export const DEFAULT_MC_USERNAME = "CraftPlayer";

function authFilePath() {
  const userData = process.env.CRAFTLAUNCHER_USER_DATA;
  if (userData) return path.join(userData, "launcher-auth.json");
  try {
    const { app } = require("electron");
    return path.join(app.getPath("userData"), "launcher-auth.json");
  } catch {
    return null;
  }
}

export function readAuthFile() {
  const file = authFilePath();
  if (!file) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}

export function writeAuthFile(data) {
  const file = authFilePath();
  if (!file) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

export function authHeaders(auth) {
  if (!auth?.sessionToken || !auth?.deviceId || !auth?.fingerprint) return null;
  return {
    Authorization: `Bearer ${auth.sessionToken}`,
    "X-Device-Id": auth.deviceId,
    "X-Device-Fingerprint": auth.fingerprint,
  };
}

/** Nombre válido para perfil offline de Minecraft (3–16, a-z A-Z 0-9 _). */
export function isValidMinecraftUsername(name) {
  if (!name || typeof name !== "string") return false;
  const trimmed = name.trim();
  return /^[a-zA-Z0-9_]{3,16}$/.test(trimmed);
}

export function normalizeMinecraftUsername(name) {
  if (!isValidMinecraftUsername(name)) return null;
  return name.trim();
}

async function verifySessionUsername(headers) {
  try {
    const res = await fetch(`${PANEL_BASE}/api/launcher-auth/verify`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.valid) return null;
    return normalizeMinecraftUsername(data.username);
  } catch {
    return null;
  }
}

/**
 * Resuelve el nombre con el que debe arrancar Minecraft (sesión de cuenta del launcher).
 */
export async function resolveLauncherUsername() {
  const auth = readAuthFile();
  if (!auth) return DEFAULT_MC_USERNAME;

  const cached = normalizeMinecraftUsername(auth.username);
  if (cached) return cached;

  const headers = authHeaders(auth);
  if (!headers) return DEFAULT_MC_USERNAME;

  const verified = await verifySessionUsername(headers);
  if (verified) {
    writeAuthFile({ ...auth, username: verified });
    return verified;
  }

  return DEFAULT_MC_USERNAME;
}
