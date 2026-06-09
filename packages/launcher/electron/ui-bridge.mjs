import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSettings } from "./launcher-settings.mjs";
import { resolveDataDir, instanceGameRoot } from "./launcher-paths.mjs";
import { normalizeGameUi, validateLoadingUi } from "./game-ui-validate.mjs";

/**
 * Puente web -> juego: sondea /api/game-ui y /api/loading-ui del panel (por versión MC)
 * y escribe craftlauncher-ui.json / craftlauncher-loading-ui.json en la instancia activa.
 */
const PANEL_BASE = process.env.CRAFTLAUNCHER_PANEL_URL || "http://localhost:3000";
const INTERVAL_MS = 2500;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let timer = null;

function panelProjectRoot() {
  return process.env.CRAFTLAUNCHER_PANEL_ROOT || path.resolve(__dirname, "../../..");
}

async function writeIfChanged(file, json) {
  let current = null;
  try {
    current = fs.readFileSync(file, "utf-8");
  } catch {
    /* no existe aún */
  }
  if (current === json) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, json, "utf-8");
}

function resolveMcVersion(settings, instanceId, dataDir) {
  if (settings.activeMcVersion) return String(settings.activeMcVersion);
  if (!instanceId) return "1.18.2";
  try {
    const metaPath = path.join(dataDir, "instances", instanceId, "meta.json");
    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      if (meta?.mcVersion) return String(meta.mcVersion);
      if (meta?.versionId) return String(meta.versionId).replace(/-forge.*$/i, "");
    }
  } catch {
    /* fallback */
  }
  return "1.18.2";
}

function readLocalGameUi(mcVersion) {
  const file = path.join(panelProjectRoot(), "data", "game-ui", `${mcVersion}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}

function readLocalLoadingUi(mcVersion) {
  const file = path.join(panelProjectRoot(), "data", "loading-ui", `${mcVersion}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}

function serializeGameUi(ui, mcVersion, launchWindow = null) {
  const { ui: normalized, warnings } = normalizeGameUi(ui, launchWindow);
  return {
    json: JSON.stringify({ ...normalized, mcVersion }, null, 2),
    warnings,
    elementCount: normalized.elements.length,
  };
}

async function fetchGameUi(mcVersion) {
  try {
    const res = await fetch(`${PANEL_BASE}/api/game-ui?version=${encodeURIComponent(mcVersion)}`, {
      cache: "no-store",
    });
    if (res.ok) return { ui: await res.json(), source: "panel" };
  } catch {
    /* panel apagado */
  }
  const local = readLocalGameUi(mcVersion);
  if (local && Array.isArray(local.elements)) return { ui: local, source: "data-local" };
  return { ui: null, source: null };
}

async function pollGameUi(gameRoot, mcVersion, launchWindow = null) {
  const { ui, source } = await fetchGameUi(mcVersion);
  if (!ui || !Array.isArray(ui.elements)) {
    return { ok: false, wrote: false, source: null, warnings: ["Sin menú del juego en panel ni en data/"], errors: [] };
  }

  const { json, warnings, elementCount } = serializeGameUi(ui, mcVersion, launchWindow);
  const file = path.join(gameRoot, "config", "craftlauncher-ui.json");
  let wrote = false;
  try {
    const current = fs.readFileSync(file, "utf-8");
    if (current !== json) {
      await writeIfChanged(file, json);
      wrote = true;
    }
  } catch {
    await writeIfChanged(file, json);
    wrote = true;
  }

  return { ok: true, wrote, source, warnings, errors: [], elementCount };
}

async function pollLoadingUi(gameRoot, mcVersion) {
  let ui = null;
  let source = "panel";
  try {
    const res = await fetch(`${PANEL_BASE}/api/loading-ui?version=${encodeURIComponent(mcVersion)}`, {
      cache: "no-store",
    });
    if (res.ok) ui = await res.json();
  } catch {
    /* panel apagado */
  }
  if (!ui || typeof ui !== "object") {
    ui = readLocalLoadingUi(mcVersion);
    source = ui ? "data-local" : null;
  }
  const validated = validateLoadingUi(ui);
  if (!validated.ok || !ui) {
    return { ok: false, wrote: false, source: null, warnings: validated.warnings, errors: validated.errors };
  }

  const file = path.join(gameRoot, "config", "craftlauncher-loading-ui.json");
  const json = JSON.stringify({ ...ui, mcVersion }, null, 2);
  let wrote = false;
  try {
    wrote = fs.readFileSync(file, "utf-8") !== json;
  } catch {
    wrote = true;
  }
  if (wrote) await writeIfChanged(file, json);
  return { ok: true, wrote, source, warnings: validated.warnings, errors: [] };
}

async function pollOnce() {
  try {
    const settings = loadSettings();
    const instanceId = settings.activeInstanceId;
    if (!instanceId) return;

    const dataDir = resolveDataDir(settings.dataDir);
    const gameRoot = instanceGameRoot(dataDir, instanceId);
    const mcVersion = resolveMcVersion(settings, instanceId, dataDir);

    await pollGameUi(gameRoot, mcVersion);
    await pollLoadingUi(gameRoot, mcVersion);
  } catch {
    /* instancia no configurada */
  }
}

export function startUiBridge() {
  if (timer) return;
  timer = setInterval(() => void pollOnce(), INTERVAL_MS);
  void pollOnce();
}

export function stopUiBridge() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

/** Sincroniza UI de juego al arrancar la instancia (sin esperar al poll). */
export async function syncGameUiNow(gameRoot, mcVersion, options = {}) {
  const launchWindow = options.launchWindow ?? null;
  const gameUi = await pollGameUi(gameRoot, mcVersion, launchWindow);
  const loadingUi = await pollLoadingUi(gameRoot, mcVersion);
  return { gameUi, loadingUi };
}
