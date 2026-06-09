import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSettings } from "./launcher-settings.mjs";
import { instanceModsDir, resolveDataDir } from "./launcher-paths.mjs";
import { isModJarBuiltForVersion, isModSupportedForVersion } from "./minecraft-versions-registry.mjs";
import { syncGameUiNow } from "./ui-bridge.mjs";
import { syncPlayerSkins } from "./skin-bridge.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOD_ID = "craftlauncher-client";
const VANILLA_BACKUP_SUFFIX = ".craftlauncher-vanilla";
const CRAFT_MOD_PREFIXES = ["craftlauncher-client", "craftlauncher-loading", "craftlauncher_loading"];

function sha1File(filePath) {
  const hash = crypto.createHash("sha1");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function defaultUiConfig() {
  return {
    schema: 2,
    hideVanillaDecor: true,
    elements: [],
  };
}

function defaultLoadingUiConfig() {
  return {
    schema: 1,
    backgroundColor: "#0a0b0d",
    overlayColor: "#00000055",
    progress: {
      enabled: true,
      anchorX: "center",
      anchorY: "top",
      offsetX: 0,
      offsetY: 146,
      widthRatio: 0.42,
      height: 3,
      color: "#6b9e78",
      trackColor: "#1a1d22",
    },
    elements: [
      {
        type: "label",
        text: "CraftLauncher",
        anchorX: "center",
        anchorY: "top",
        offsetX: 0,
        offsetY: 100,
        w: 200,
        h: 16,
        textColor: "#c8cad0",
      },
    ],
  };
}

/** Crea configs por defecto si no existen (el mod las lee en runtime). */
export function ensureCraftLauncherConfigs(gameRoot) {
  const dir = path.join(gameRoot, "config");
  fs.mkdirSync(dir, { recursive: true });

  const uiFile = path.join(dir, "craftlauncher-ui.json");
  if (!fs.existsSync(uiFile)) {
    fs.writeFileSync(uiFile, JSON.stringify(defaultUiConfig(), null, 2), "utf-8");
  }

  const loadingFile = path.join(dir, "craftlauncher-loading-ui.json");
  if (!fs.existsSync(loadingFile)) {
    fs.writeFileSync(loadingFile, JSON.stringify(defaultLoadingUiConfig(), null, 2), "utf-8");
  }
}

function findClientJars(roots) {
  const found = [];
  const seen = new Set();

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".jar")) {
        const norm = path.normalize(full).toLowerCase();
        if (seen.has(norm)) continue;
        seen.add(norm);
        found.push(full);
      }
    }
  }

  for (const root of roots) {
    if (root && fs.existsSync(root)) walk(root);
  }
  return found;
}

export function restoreLegacyClientJarPatches({ gameRoot, libraryRoot, onProgress }) {
  const roots = [
    libraryRoot && path.join(libraryRoot, "net", "minecraft", "client"),
    libraryRoot && path.join(libraryRoot, "net", "minecraftforge", "forge"),
    path.join(gameRoot, "libraries", "net", "minecraft", "client"),
    path.join(gameRoot, "libraries", "net", "minecraftforge", "forge"),
  ].filter(Boolean);

  let restored = 0;
  for (const jarPath of findClientJars(roots)) {
    const backup = `${jarPath}${VANILLA_BACKUP_SUFFIX}`;
    if (!fs.existsSync(backup)) continue;
    fs.copyFileSync(backup, jarPath);
    restored += 1;
  }

  const marker = path.join(gameRoot, ".craftlauncher", ".craftlauncher-client-fork.json");
  if (fs.existsSync(marker)) fs.unlinkSync(marker);

  if (restored > 0) {
    onProgress?.({
      stage: "install-log",
      level: "ok",
      message: "Client jar",
      detail: `Restaurados ${restored} jar(s) vanilla (parches legacy eliminados)`,
    });
  }

  return { restored };
}

function readModMeta(jarPath) {
  const metaPath = `${jarPath}.meta.json`;
  if (!fs.existsSync(metaPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(metaPath, "utf-8"));
  } catch {
    return null;
  }
}

/**
 * Solo devuelve un JAR si existe craftlauncher-client-{mcVersion}.jar
 * CON su .meta.json que confirma la misma mcVersion (evita JARs renombrados).
 */
function resolveBundledModJar(mcVersion) {
  const v = String(mcVersion ?? "").trim();
  if (!isModSupportedForVersion(v)) return null;
  if (!isModJarBuiltForVersion(v)) return null;

  const jarName = `${MOD_ID}-${v}.jar`;
  const roots = [
    path.join(__dirname, "..", "assets", "mods"),
    path.join(__dirname, "..", "assets", "client-patches", v),
    path.join(__dirname, "..", "..", "craftlauncher-loading-mod", "build", "libs"),
    path.join(__dirname, "..", "..", "craftlauncher-client-mod-1.16.5", "build", "libs"),
    path.join(__dirname, "..", "..", "craftlauncher-client-mod-1.19.2", "build", "libs"),
    path.join(__dirname, "..", "..", "craftlauncher-client-mod-1.20.1", "build", "libs"),
    path.join(__dirname, "..", "..", "craftlauncher-client-mod-1.21.1", "build", "libs"),
    path.join(__dirname, "..", "..", "craftlauncher-client-mod-1.12.2", "build", "libs"),
  ];

  for (const root of roots) {
    const full = path.join(root, jarName);
    if (!fs.existsSync(full)) continue;

    const meta = readModMeta(full);
    if (meta && meta.mcVersion !== v) {
      continue;
    }

    return { path: full, meta, jarName };
  }

  return null;
}

function isCraftLauncherModFile(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".jar.meta.json")) {
    return CRAFT_MOD_PREFIXES.some((p) => lower.startsWith(p));
  }
  if (!name.endsWith(".jar")) return false;
  return CRAFT_MOD_PREFIXES.some((p) => lower.startsWith(p));
}

/** Quita mods CraftLauncher incompatibles o mal renombrados de mods/. */
export function removeCraftLauncherMods(modsDir, mcVersion, onProgress) {
  if (!fs.existsSync(modsDir)) return { removed: [] };

  const valid = resolveBundledModJar(mcVersion);
  const validName = valid?.jarName ?? null;
  const removed = [];

  for (const name of fs.readdirSync(modsDir)) {
    if (!isCraftLauncherModFile(name)) continue;
    if (validName && name === validName) continue;

    try {
      fs.unlinkSync(path.join(modsDir, name));
      removed.push(name);
    } catch {
      /* ignore */
    }
  }

  if (removed.length > 0) {
    onProgress?.({
      stage: "install-log",
      level: "warn",
      message: "Mod CraftLauncher",
      detail: `Eliminado(s) incompatible(s) con ${mcVersion}: ${removed.join(", ")}`,
    });
  }

  return { removed };
}

/** Instala el mod solo si hay JAR compilado para ESA versión exacta. */
export function installCraftLauncherMod({ gameRoot, mcVersion, instanceId, onProgress }) {
  const v = String(mcVersion ?? "").trim();
  const dataDir = resolveDataDir(loadSettings().dataDir);
  const modsDir = instanceId ? instanceModsDir(dataDir, instanceId) : path.join(gameRoot, "mods");
  fs.mkdirSync(modsDir, { recursive: true });

  removeCraftLauncherMods(modsDir, v, onProgress);
  for (const name of fs.readdirSync(modsDir)) {
    if (!name.toLowerCase().endsWith(".jar.meta.json")) continue;
    if (!isCraftLauncherModFile(name)) continue;
    try {
      fs.unlinkSync(path.join(modsDir, name));
    } catch {
      /* ignore */
    }
  }

  if (!isModSupportedForVersion(v)) {
    onProgress?.({
      stage: "install-log",
      level: "info",
      message: "Mod CraftLauncher",
      detail: `${v} no está en el catálogo de mods — el juego arranca vanilla Forge`,
    });
    return { installed: false, reason: "version-unsupported" };
  }

  if (!isModJarBuiltForVersion(v)) {
    onProgress?.({
      stage: "install-log",
      level: "warn",
      message: "Mod CraftLauncher",
      detail: `${v} sin JAR compilado — ejecuta: npm run build:client-mod -- ${v}`,
    });
    return { installed: false, reason: "mod-jar-missing" };
  }

  const bundled = resolveBundledModJar(v);
  if (!bundled) {
    onProgress?.({
      stage: "install-log",
      level: "warn",
      message: "Mod CraftLauncher",
      detail: `Falta ${MOD_ID}-${v}.jar — compila: npm run build:client-mod -- ${v}`,
    });
    return { installed: false, reason: "mod-jar-missing" };
  }

  const targetPath = path.join(modsDir, bundled.jarName);
  const sourceHash = sha1File(bundled.path);
  const markerFile = path.join(gameRoot, ".craftlauncher", "client-mod.json");
  fs.mkdirSync(path.dirname(markerFile), { recursive: true });

  let marker = null;
  if (fs.existsSync(markerFile)) {
    try {
      marker = JSON.parse(fs.readFileSync(markerFile, "utf-8"));
    } catch {
      marker = null;
    }
  }

  // Meta lateral solo en assets — no copiar .meta.json a mods/ (Forge lo escanea y avisa).
  const metaSrc = `${bundled.path}.meta.json`;
  let bundledMeta = null;
  if (fs.existsSync(metaSrc)) {
    try {
      bundledMeta = JSON.parse(fs.readFileSync(metaSrc, "utf-8"));
    } catch {
      bundledMeta = null;
    }
  }

  if (!fs.existsSync(targetPath) || marker?.sourceHash !== sourceHash || marker?.mcVersion !== v) {
    fs.copyFileSync(bundled.path, targetPath);
    fs.writeFileSync(
      markerFile,
      JSON.stringify(
        {
          sourceHash,
          targetName: bundled.jarName,
          mcVersion: v,
          forgeVersion: bundledMeta?.forgeVersion ?? null,
          loaderVersion: bundledMeta?.loaderVersion ?? null,
          updatedAt: new Date().toISOString(),
        },
        null,
        2
      ),
      "utf-8"
    );
    onProgress?.({
      stage: "install-log",
      level: "ok",
      message: "Mod CraftLauncher",
      detail: `Instalado ${bundled.jarName} para Minecraft ${v}`,
    });
  } else {
    onProgress?.({
      stage: "install-log",
      level: "info",
      message: "Mod CraftLauncher",
      detail: `Mod ya instalado (${bundled.jarName})`,
    });
  }

  return { installed: true, modPath: targetPath };
}

export async function setupCraftLauncherClient({
  gameRoot,
  mcVersion,
  libraryRoot,
  instanceId,
  launchWindow,
  minecraftUsername,
  onProgress,
}) {
  const settings = loadSettings();
  if (settings.clientMod?.enabled === false) {
    return { ok: false, reason: "disabled" };
  }

  restoreLegacyClientJarPatches({ gameRoot, libraryRoot, onProgress });
  ensureCraftLauncherConfigs(gameRoot);
  const result = installCraftLauncherMod({ gameRoot, mcVersion, instanceId, onProgress });
  const uiSync = await syncGameUiNow(gameRoot, mcVersion, { launchWindow });
  const skinSync = await syncPlayerSkins({ gameRoot, onProgress, minecraftUsername });
  return { ...result, uiSync, skinSync };
}
