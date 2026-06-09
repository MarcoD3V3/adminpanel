import fs from "node:fs";
import { hubLayoutCachePath, resolveDataDir } from "./launcher-paths.mjs";
import { loadSettings } from "./launcher-settings.mjs";

const CACHE_VERSION = 1;

function isHubLayout(value) {
  if (!value || typeof value !== "object") return false;
  const v = value;
  return (
    typeof v.id === "string" &&
    typeof v.activeScreenId === "string" &&
    Array.isArray(v.screens) &&
    v.screens.length > 0
  );
}

function hubLayoutFingerprint(layout) {
  const copy = JSON.parse(JSON.stringify(layout));
  copy.updatedAt = "";
  return JSON.stringify(copy);
}

function cacheFilePath() {
  const settings = loadSettings();
  const dataDir = resolveDataDir(settings.dataDir);
  return hubLayoutCachePath(dataDir);
}

export function readHubLayoutCache() {
  try {
    const raw = fs.readFileSync(cacheFilePath(), "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const layout = parsed.layout;
    if (!isHubLayout(layout)) return null;
    return {
      version: parsed.version ?? CACHE_VERSION,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : null,
      fingerprint: typeof parsed.fingerprint === "string" ? parsed.fingerprint : hubLayoutFingerprint(layout),
      layout,
    };
  } catch {
    return null;
  }
}

export function writeHubLayoutCache(layout) {
  if (!isHubLayout(layout)) {
    throw new Error("Layout inválido para caché");
  }
  const file = cacheFilePath();
  fs.mkdirSync(resolveDataDir(loadSettings().dataDir), { recursive: true });
  const payload = {
    version: CACHE_VERSION,
    savedAt: new Date().toISOString(),
    fingerprint: hubLayoutFingerprint(layout),
    layout,
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf-8");
  return payload;
}
