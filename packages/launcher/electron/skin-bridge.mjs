import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  authHeaders,
  DEFAULT_MC_USERNAME,
  readAuthFile,
  resolveLauncherUsername,
} from "./launcher-session.mjs";
import { getPanelBase } from "./panel-base.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function panelProjectRoot() {
  return process.env.CRAFTLAUNCHER_PANEL_ROOT || path.resolve(__dirname, "../../..");
}

function safeUsernameKey(username) {
  return String(username)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

function normalizeSessionUsername(name) {
  if (!name || typeof name !== "string") return null;
  const trimmed = name.trim();
  return /^[a-zA-Z0-9_]{3,16}$/.test(trimmed) ? trimmed : null;
}

function readLocalSkinMeta() {
  const metaPath = path.join(panelProjectRoot(), "data", "user-skins", "meta.json");
  try {
    const parsed = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
    if (!parsed?.entries || typeof parsed.entries !== "object") return [];
    return Object.values(parsed.entries).filter((e) => e?.userId && e?.username);
  } catch {
    return [];
  }
}

function tryReadLocalSkin(userId) {
  const localPath = path.join(panelProjectRoot(), "data", "user-skins", `${userId}.png`);
  if (!fs.existsSync(localPath)) return null;
  try {
    return fs.readFileSync(localPath);
  } catch {
    return null;
  }
}

async function fetchJson(url, headers) {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchPng(url, headers) {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function syncPlayerSkins({ gameRoot, onProgress, minecraftUsername }) {
  const auth = readAuthFile();
  const headers = authHeaders(auth);
  const mcName = minecraftUsername ?? (await resolveLauncherUsername());
  const mcPlayerKey = safeUsernameKey(mcName);

  let entries = [];
  if (headers) {
    const registry = await fetchJson(`${getPanelBase()}/api/launcher-auth/skins?action=registry`, headers);
    if (Array.isArray(registry?.entries)) entries = registry.entries;
  }
  if (entries.length === 0) entries = readLocalSkinMeta();

  const sessionName = normalizeSessionUsername(auth?.username) ?? mcName;
  const localUsername = sessionName
    ? safeUsernameKey(sessionName)
    : entries.length === 1
      ? safeUsernameKey(entries[0].username)
      : null;

  fs.mkdirSync(path.join(gameRoot, "config", "craftlauncher", "skins"), { recursive: true });

  const players = {};
  let copied = 0;

  for (const entry of entries) {
    const key = safeUsernameKey(entry.username);
    if (!key) continue;

    let png = tryReadLocalSkin(entry.userId);
    if (!png && headers) {
      png = await fetchPng(
        `${getPanelBase()}/api/launcher-auth/skins?action=file&username=${encodeURIComponent(entry.username)}`,
        headers
      );
    }
    if (!png?.length) continue;

    const relPath = `craftlauncher/skins/${key}.png`;
    fs.writeFileSync(path.join(gameRoot, "config", relPath), png);
    players[key] = relPath;
    copied += 1;
  }

  let localSkin = null;
  if (localUsername && players[localUsername]) {
    localSkin = players[localUsername];
    if (mcPlayerKey && mcPlayerKey !== localUsername) {
      players[mcPlayerKey] = localSkin;
    }
  } else if (mcPlayerKey && copied === 1) {
    const only = Object.values(players)[0];
    if (only) {
      localSkin = only;
      players[mcPlayerKey] = only;
    }
  }

  const config = {
    schema: 1,
    localUsername,
    minecraftUsername: mcPlayerKey,
    localSkin,
    players,
    syncedAt: new Date().toISOString(),
  };

  const configPath = path.join(gameRoot, "config", "craftlauncher-skins.json");
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

  onProgress?.({
    stage: "install-log",
    level: copied > 0 ? "ok" : "warn",
    message: "Skins CraftLauncher",
    detail:
      copied > 0
        ? `Skin sincronizada (${localUsername ?? "cuenta"} → ${mcName})`
        : "No se copió ninguna skin — sube una en Mi skin y vuelve a lanzar",
  });

  return { ok: copied > 0, count: copied, localUsername, minecraftUsername: mcPlayerKey };
}
