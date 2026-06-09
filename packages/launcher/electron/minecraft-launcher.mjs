import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

import { resolveForgeVersion } from "./forge-versions.mjs";
import { ensureForgeInstaller } from "./forge-installer.mjs";
import { ensureJavaForMinecraft } from "./java-bootstrap.mjs";
import {
  prepareLaunchCache,
  essentialLibrariesPresent,
  invalidateLibraryMarkerIfIncomplete,
} from "./launch-cache.mjs";
import { getActiveInstance } from "./instances.mjs";
import { instanceGameRoot, resolveDataDir, resolveUserData } from "./launcher-paths.mjs";
import { setupCraftLauncherClient } from "./craftlauncher-mod.mjs";
import { applyUiPack } from "./ui-pack.mjs";
import { resolveMinecraftLaunchWindow } from "./minecraft-window.mjs";
import { runPrelaunchChecks } from "./prelaunch-checks.mjs";
import { resolveLauncherUsername } from "./launcher-session.mjs";

import pkg from "minecraft-launcher-core";

const { Client, Authenticator } = pkg;

export const LAUNCHER_MAIN_REV = "2026-06-02k";

const QUIET_LOG = /^(classes:|assets:|Downloaded|Attempting|Using Java|\[MCLC\]: Launching with arguments|\[CraftLauncher\])/i;
/** El juego está realmente en marcha (no solo "Launching with arguments" de MCLC). */
const GAME_RUNNING =
  /LWJGL version|OpenGL version|Sound engine started|Created: \d+x\d+|Minecraft is currently running/i;
/** Fallo real al arrancar (no avisos de mods/recursos con la palabra "ERROR"). */
const LAUNCH_FATAL =
  /ClassNotFoundException|NoClassDefFoundError|Could not find or load main class|UnsupportedClassVersionError|A JNI error has occurred|verify your installation has been completed|Exception in thread "main"|^FATAL\b|IllegalArgumentException|ResolutionException|MixinApplyError|MixinTransformerError|InvalidAccessorException|Initializing game|Failed to verify authentication|ReportedException|Rendering screen|NullPointerException/i;

const PRE_LAUNCH_WARN =
  /Could not find or load main class|Error: Could not find the main class|Failed to start the minecraft server/i;

/** Ruido habitual con el juego ya abierto (mods, shaders, recursos). */
const IN_GAME_LOG_NOISE =
  /\[.*\/(ERROR|WARN)\]:|Failed to load resource|Failed to load texture|Unable to load|Error loading|Could not load sound|ShaderInstance|could not find sampler|SLF4J|log4j/i;

function isPreLaunchFailureLine(line) {
  if (/\[(WARN|INFO|DEBUG)\]|\/WARN\]|\/INFO\]/i.test(line)) return false;
  if (/ShaderInstance|could not find sampler/i.test(line)) return false;
  if (LAUNCH_FATAL.test(line) || PRE_LAUNCH_WARN.test(line)) return true;
  if (/^Error:/i.test(line) && /main class/i.test(line)) return true;
  return false;
}

/** @type {import("minecraft-launcher-core").Client | null} */
let activeClient = null;

function step(onProgress, message, detail, level = "step") {
  onProgress?.({
    stage: "install-log",
    level,
    message,
    detail,
    time: new Date().toISOString(),
  });
}

function emit(onProgress, payload) {
  onProgress?.(payload);
}

function logLineLevel(line) {
  if (/\b(FATAL|ReportedException)\b/i.test(line) || /\/ERROR\]/i.test(line)) return "error";
  if (/\/WARN\]/i.test(line)) return "warn";
  if (/\/INFO\]/i.test(line)) return "info";
  return "step";
}

function readLatestLogHint(gameRoot) {
  const file = path.join(gameRoot, "logs", "latest.log");
  if (!fs.existsSync(file)) return null;
  try {
    const tail = fs.readFileSync(file, "utf8").slice(-12_000);
    const lines = tail.split(/\r?\n/).filter(Boolean);
    const err = lines.findLast((l) => /Caused by:|ReportedException|Exception in thread/i.test(l));
    return err?.trim() ?? null;
  } catch {
    return null;
  }
}

function readLatestCrashHint(gameRoot) {
  const dir = path.join(gameRoot, "crash-reports");
  if (!fs.existsSync(dir)) return null;
  let latest = null;
  let latestMtime = 0;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith("-client.txt")) continue;
    const full = path.join(dir, name);
    let mtime = 0;
    try {
      mtime = fs.statSync(full).mtimeMs;
    } catch {
      continue;
    }
    if (mtime < latestMtime) continue;
    latestMtime = mtime;
    latest = full;
  }
  if (!latest) return null;
  try {
    const text = fs.readFileSync(latest, "utf8");
    const desc = text.match(/Description:\s*(.+)/)?.[1]?.trim();
    const cause =
      text.match(/java\.lang\.[A-Za-z0-9_$]+(?:: [^\n]+)?/)?.[0] ??
      text.match(/Caused by: ([^\n]+)/)?.[1]?.trim();
    if (desc && cause) return `${desc} — ${cause}`;
    return desc ?? cause ?? null;
  } catch {
    return null;
  }
}

function formatCrashMessage(code, hint, gameHadStarted) {
  const base =
    typeof code === "number" && code !== 0
      ? `Minecraft terminó con código ${code}`
      : "Minecraft no pudo iniciarse";
  if (!hint) {
    return gameHadStarted
      ? `${base}. Si se cerró al instante, abre el registro o latest.log en la carpeta del juego.`
      : `${base}. En 1.12.2 Forge suele faltar la instalación del cliente — el launcher intentará instalarlo en el próximo intento.`;
  }
  const short = hint.length > 420 ? `${hint.slice(0, 420)}…` : hint;
  return `${base}: ${short}`;
}

function readForgeVersionMeta(root, mcVersion) {
  const versionPath = path.join(root, "forge", mcVersion, "version.json");
  if (!fs.existsSync(versionPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(versionPath, "utf8"));
  } catch {
    return null;
  }
}

function readInstalledVersionMeta(root, customId) {
  const jsonPath = path.join(root, "versions", customId, `${customId}.json`);
  if (!fs.existsSync(jsonPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  } catch {
    return null;
  }
}

function legacyForgeLibraryJar(root, meta) {
  const lib = meta?.libraries?.find(
    (entry) => typeof entry?.name === "string" && entry.name.startsWith("net.minecraftforge:forge:")
  );
  const rel = lib?.downloads?.artifact?.path;
  if (!rel) return null;
  const jarPath = path.join(root, "libraries", rel);
  return fs.existsSync(jarPath) ? jarPath : null;
}

const FORGE_WRAPPER_VERSION = "1.6.0";

function forgewrapperJarPath(libraryRoot, version = FORGE_WRAPPER_VERSION) {
  return path.join(
    libraryRoot,
    "io",
    "github",
    "zekerzhayard",
    "ForgeWrapper",
    version,
    `ForgeWrapper-${version}.jar`
  );
}

function forgewrapperJarPresent(libraryRoot) {
  if (!libraryRoot) return false;
  const jar = forgewrapperJarPath(libraryRoot);
  try {
    return fs.existsSync(jar) && fs.statSync(jar).size > 5000;
  } catch {
    return false;
  }
}

function isModernForgeMeta(meta) {
  if (!meta?.inheritsFrom) return false;
  const minor = parseInt(String(meta.inheritsFrom).split(".")[1] ?? "0", 10);
  return minor > 12;
}

function forgewrapperReady(root, libraryRoot) {
  return (
    forgewrapperJarPresent(libraryRoot) ||
    forgewrapperJarPresent(path.join(root, "libraries"))
  );
}

/** Elimina JSON de Forge a medias (mainClass ForgeWrapper sin el jar en libraries). */
function invalidateBrokenModernForge(root, customId, libraryRoot) {
  const meta = readInstalledVersionMeta(root, customId);
  if (!meta?.mainClass?.includes("forgewrapper")) return;
  if (forgewrapperReady(root, libraryRoot)) return;

  for (const versionJson of [
    path.join(root, "versions", customId, `${customId}.json`),
    path.join(root, "forge", meta.inheritsFrom ?? "1.16.5", "version.json"),
  ]) {
    try {
      if (fs.existsSync(versionJson)) fs.unlinkSync(versionJson);
    } catch {
      /* ignore */
    }
  }
}

async function ensureForgewrapperJar(libraryRoot, onProgress) {
  if (!libraryRoot || forgewrapperJarPresent(libraryRoot)) return;
  const dest = forgewrapperJarPath(libraryRoot);
  const url = `https://github.com/ZekerZhayard/ForgeWrapper/releases/download/${FORGE_WRAPPER_VERSION}/ForgeWrapper-${FORGE_WRAPPER_VERSION}.jar`;

  step(onProgress, "Descargando ForgeWrapper…", path.basename(dest));
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`No se pudo descargar ForgeWrapper (${res.status}). Comprueba tu conexión.`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 5000) {
    throw new Error("ForgeWrapper descargado está vacío o corrupto.");
  }
  fs.writeFileSync(dest, buf);
  step(onProgress, "ForgeWrapper listo", dest, "ok");
}

function isModernMcVersion(mcVersion) {
  return parseInt(String(mcVersion).split(".")[1] ?? "0", 10) > 12;
}

/** Forge moderno: `versions/<id>/<id>.jar`. Legacy 1.12.2: solo JSON + hereda vanilla + jar en libraries. */
function forgeClientInstalled(root, customId, libraryRoot) {
  if (!customId) return false;
  const versionJson = path.join(root, "versions", customId, `${customId}.json`);
  const versionJar = path.join(root, "versions", customId, `${customId}.jar`);

  const meta = readInstalledVersionMeta(root, customId);

  if (fs.existsSync(versionJar) && fs.existsSync(versionJson)) {
    if (meta && isModernForgeMeta(meta) && meta.mainClass?.includes("forgewrapper")) {
      return forgewrapperReady(root, libraryRoot);
    }
    return true;
  }

  if (!meta?.inheritsFrom) return false;

  if (isModernForgeMeta(meta)) {
    if (meta.mainClass?.includes("forgewrapper")) {
      return forgewrapperReady(root, libraryRoot);
    }
    const parentJar = path.join(root, "versions", meta.inheritsFrom, `${meta.inheritsFrom}.jar`);
    if (!fs.existsSync(parentJar)) return false;
    return Boolean(legacyForgeLibraryJar(root, meta));
  }

  const parentJar = path.join(root, "versions", meta.inheritsFrom, `${meta.inheritsFrom}.jar`);
  if (!fs.existsSync(parentJar)) return false;

  return Boolean(legacyForgeLibraryJar(root, meta));
}

async function ensureLegacyForgeLibrary(root, meta, onProgress) {
  const lib = meta?.libraries?.find(
    (entry) => typeof entry?.name === "string" && entry.name.startsWith("net.minecraftforge:forge:")
  );
  const artifact = lib?.downloads?.artifact;
  if (!artifact?.path) return;

  const dest = path.join(root, "libraries", artifact.path);
  if (fs.existsSync(dest)) return;

  const url =
    (artifact.url && String(artifact.url).trim()) ||
    `https://maven.minecraftforge.net/${artifact.path.replace(/\\/g, "/")}`;

  step(onProgress, "Descargando librería Forge…", path.basename(dest));
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`No se pudo descargar ${path.basename(dest)} (${res.status})`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 10_000) {
    throw new Error(`Librería Forge corrupta o vacía: ${path.basename(dest)}`);
  }
  fs.writeFileSync(dest, buf);
}

function legacyForgeVersionId(mcVersion, forgeVersion) {
  return `${mcVersion}-forge-${forgeVersion}`;
}

/** Perfil mínimo que el instalador legacy de Forge exige en la carpeta del juego. */
function ensureLauncherProfiles(root, mcVersion) {
  const file = path.join(root, "launcher_profiles.json");
  if (fs.existsSync(file)) return;

  const payload = {
    profiles: {
      CraftLauncher: {
        name: "CraftLauncher",
        lastVersionId: mcVersion,
        gameDir: root,
      },
    },
    selectedProfile: "CraftLauncher",
    clientToken: "00000000000000000000000000000000",
  };
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf8");
}

/** Forge 1.12.2: `java -jar installer.jar --installClient <carpeta>` (no usa --installDir). */
async function ensureLegacyForgeClient(root, mcVersion, forgeVersion, forgeInstallerJar, javaPath, onProgress) {
  const mcMinor = parseInt(mcVersion.split(".")[1] ?? "0", 10);
  if (mcMinor !== 12) return false;

  const versionId = legacyForgeVersionId(mcVersion, forgeVersion);
  if (forgeClientInstalled(root, versionId, path.join(root, "libraries"))) return true;

  ensureLauncherProfiles(root, mcVersion);

  step(onProgress, "Instalando Forge en la instancia (primera vez, 1–3 min)…");
  const targetRoot = path.resolve(root);
  try {
    execFileSync(
      javaPath,
      ["-jar", path.resolve(forgeInstallerJar), "--installClient", targetRoot],
      {
        cwd: targetRoot,
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 600_000,
        windowsHide: true,
      }
    );
  } catch (e) {
    const stderr = e.stderr?.toString?.() ?? "";
    const stdout = e.stdout?.toString?.() ?? "";
    const detail = `${stdout}\n${stderr}`.trim().slice(-900);
    const unrecognized = /UnrecognizedOptionException:\s*(\S+)/.exec(detail);
    throw new Error(
      detail
        ? `Forge no se instaló en la carpeta del juego:\n${detail}`
        : unrecognized
          ? `Argumento no válido para el instalador Forge: ${unrecognized[1]}`
          : "Forge no se instaló. Comprueba Java 8 y espacio en disco."
    );
  }

  const installedMeta = readInstalledVersionMeta(root, versionId);
  if (!installedMeta) {
    throw new Error(
      `Tras el instalador no apareció versions/${versionId}/${versionId}.json. Comprueba conexión y vuelve a intentar.`
    );
  }

  try {
    await ensureLegacyForgeLibrary(root, installedMeta, onProgress);
  } catch {
    /* MCLC puede descargarla al lanzar si falla la red */
  }

  if (!forgeClientInstalled(root, versionId, path.join(root, "libraries"))) {
    throw new Error(
      `Forge no quedó listo en la instancia (falta ${versionId}.json, 1.12.2.jar o la librería forge). Vuelve a intentar.`
    );
  }

  step(onProgress, "Forge instalado en la instancia", versionId, "ok");
  return true;
}

function resolveForgeLaunchOptions(cfg, root, cacheState, forgeInstallerJar) {
  const version = { number: cfg.mcVersion, type: "release" };
  const libraryRoot = cacheState?.libraryRoot ?? path.join(root, "libraries");
  const customId = legacyForgeVersionId(cfg.mcVersion, cfg.forgeVersion);
  const meta = readForgeVersionMeta(root, cfg.mcVersion);
  const resolvedId =
    meta?.id && forgeClientInstalled(root, meta.id, libraryRoot) ? meta.id : customId;

  invalidateBrokenModernForge(root, resolvedId, libraryRoot);
  invalidateBrokenModernForge(root, customId, libraryRoot);

  if (isModernMcVersion(cfg.mcVersion) && !forgewrapperReady(root, libraryRoot)) {
    return { version, forge: forgeInstallerJar };
  }

  if (forgeClientInstalled(root, resolvedId, libraryRoot)) {
    return {
      version: { ...version, custom: resolvedId },
      forge: undefined,
    };
  }

  return { version, forge: forgeInstallerJar };
}

function resolveLaunchContext(versionId, opts = {}) {
  const { settings, instances } = getActiveInstance();
  let instance =
    (opts.instanceId && instances.find((i) => i.id === opts.instanceId)) || null;
  if (!instance) {
    instance =
      instances.find((i) => i.id === settings.activeInstanceId) ?? instances[0] ?? null;
  }
  const dataDir = resolveDataDir(settings.dataDir);

  if (instance) {
    const forgeVersion = instance.forgeVersion || resolveForgeVersion(instance.mcVersion).forgeVersion;
    const cfg = {
      id: instance.mcVersion,
      mcVersion: instance.mcVersion,
      forgeVersion,
      label: `${instance.name} · ${instance.mcVersion} Forge`,
    };
    return {
      cfg,
      root: instanceGameRoot(dataDir, instance.id),
      instance,
      dataDir,
    };
  }

  const cfg = resolveForgeVersion(versionId);
  return {
    cfg,
    root: path.join(dataDir, "legacy", cfg.mcVersion),
    instance: null,
    dataDir,
  };
}

export async function launchForgeMinecraft(versionId, onProgress, opts = {}) {
  const { cfg, root, instance, dataDir } = resolveLaunchContext(versionId, opts);
  const userData = resolveUserData(opts.userData);

  fs.mkdirSync(root, { recursive: true });

  emit(onProgress, {
    stage: "checking",
    message: `Motor ${LAUNCHER_MAIN_REV} — comprobando Java…`,
    versionLabel: cfg.label,
  });
  step(onProgress, "Perfil activo", instance?.name ?? "Legacy", "info");
  step(onProgress, "Carpeta de juego", root, "info");

  const cacheState = await prepareLaunchCache(root, dataDir, cfg.mcVersion);
  invalidateLibraryMarkerIfIncomplete(cacheState.libraryRoot, cfg.mcVersion);
  invalidateLibraryMarkerIfIncomplete(path.join(root, "libraries"), cfg.mcVersion);

  if (cacheState.quickLaunch && essentialLibrariesPresent(cacheState.libraryRoot, cfg.mcVersion)) {
    step(onProgress, "Caché lista", "Atlas + librerías + Forge ya instalados", "ok");
    emit(onProgress, {
      stage: "checking",
      message: "Arranque rápido — verificando caché local…",
    });
  } else {
    const needLibs = !essentialLibrariesPresent(cacheState.libraryRoot, cfg.mcVersion);
    emit(onProgress, {
      stage: "checking",
      message: needLibs
        ? "Descargando librerías de Minecraft (Guava, etc.) — primera vez, 2–5 min…"
        : cacheState.forgeReady
          ? "Primera sincronización del atlas (solo una vez por versión)…"
          : "Instalación inicial de Forge y librerías…",
    });
  }

  const javaPath = await ensureJavaForMinecraft(cfg.mcVersion, userData, (p) => {
    const isJavaOk = p.stage === "java-ok";
    const isJavaDownload =
      /descargando java|extrayendo java/i.test(String(p.message ?? "")) ||
      (p.stage === "progress" && /java/i.test(String(p.message ?? "")));

    if (p.message && (isJavaOk || isJavaDownload)) {
      step(onProgress, p.message, p.detail ? String(p.detail) : undefined, isJavaOk ? "ok" : "step");
    }

    if (isJavaOk || isJavaDownload || p.stage === "checking") {
      emit(onProgress, p);
    }
  });

  step(onProgress, "Java listo", javaPath, "ok");

  emit(onProgress, {
    stage: "start",
    message: `Preparando ${cfg.label} (Forge ${cfg.forgeVersion})…`,
    versionLabel: cfg.label,
  });

  step(
    onProgress,
    cacheState.forgeReady ? "Instalador Forge" : "Descargando instalador Forge",
    `${cfg.mcVersion}-${cfg.forgeVersion}`
  );

  const forgeJar = path.resolve(
    await ensureForgeInstaller(root, cfg.mcVersion, cfg.forgeVersion, (p) => {
      if (cacheState.forgeReady) return;
      if (p.message) {
        step(onProgress, p.message);
        emit(onProgress, p);
      }
    })
  );

  if (!forgeJar.endsWith(".jar") || !forgeJar.includes("installer")) {
    throw new Error(`Forge inválido: ${forgeJar}`);
  }
  if (!fs.existsSync(forgeJar)) {
    throw new Error(`Instalador Forge no encontrado: ${forgeJar}`);
  }
  step(onProgress, "Instalador Forge", path.basename(forgeJar), "ok");

  const launcher = new Client();
  activeClient = launcher;

  let launchFailed = false;
  let failMessage = "";
  let gameLaunched = false;
  let lastProgressKey = "";
  let lastProgressAt = 0;
  const recentLines = [];

  const rememberLine = (line) => {
    const t = line.trim();
    if (!t) return;
    recentLines.push(t);
    if (recentLines.length > 120) recentLines.shift();
  };

  const latestLogPath = path.join(root, "logs", "latest.log");
  let latestLogOffset = 0;
  let latestLogTailTimer = null;

  const tailLatestLog = () => {
    if (!fs.existsSync(latestLogPath)) return;
    try {
      const stat = fs.statSync(latestLogPath);
      if (stat.size < latestLogOffset) latestLogOffset = 0;
      if (stat.size <= latestLogOffset) return;
      const size = stat.size - latestLogOffset;
      const buf = Buffer.alloc(size);
      const fd = fs.openSync(latestLogPath, "r");
      fs.readSync(fd, buf, 0, size, latestLogOffset);
      fs.closeSync(fd);
      latestLogOffset = stat.size;
      for (const line of buf.toString("utf8").split(/\r?\n/)) {
        const t = line.trim();
        if (!t) continue;
        rememberLine(t);
        const level = logLineLevel(t);
        if (IN_GAME_LOG_NOISE.test(t) && level !== "error") continue;
        emit(onProgress, { stage: "install-log", level, message: t.slice(0, 500) });
      }
    } catch {
      /* ignore tail errors */
    }
  };

  const stopLatestLogTail = () => {
    if (latestLogTailTimer) {
      clearInterval(latestLogTailTimer);
      latestLogTailTimer = null;
    }
  };

  let lastEmitAt = Date.now();
  const touchProgress = (payload) => {
    lastEmitAt = Date.now();
    if (gameLaunched && (payload.stage === "progress" || payload.stage === "downloading")) return;
    emit(onProgress, payload);
  };

  const markGameRunning = () => {
    if (gameLaunched) return;
    gameLaunched = true;
    launchFailed = false;
    failMessage = "";
    try {
      if (fs.existsSync(latestLogPath)) {
        latestLogOffset = fs.statSync(latestLogPath).size;
      }
    } catch {
      latestLogOffset = 0;
    }
    if (!latestLogTailTimer) {
      latestLogTailTimer = setInterval(tailLatestLog, 400);
    }
    emit(onProgress, {
      stage: "launched",
      message: "Minecraft en ejecución — registro en vivo abajo",
      percent: 100,
    });
    step(onProgress, "Juego en marcha", instance?.name ?? cfg.label, "ok");
  };

  const pushLogLine = (line, { force = false } = {}) => {
    const level = logLineLevel(line);
    if (!force && gameLaunched && IN_GAME_LOG_NOISE.test(line) && level !== "error") return;
    if (!gameLaunched && QUIET_LOG.test(line) && level === "step") return;
    emit(onProgress, { stage: "install-log", level, message: line.slice(0, 500) });
    if (!QUIET_LOG.test(line) || level !== "step") {
      emit(onProgress, { stage: "log", message: line.slice(0, 300) });
    }
  };

  const watchLog = (line) => {
    rememberLine(line);
    if (/Caused by:|MixinApplyError|ResolutionException|InvalidAccessorException|ReportedException/i.test(line)) {
      failMessage = failMessage ? `${failMessage} · ${line}` : line;
    }

    if (GAME_RUNNING.test(line)) {
      markGameRunning();
    }

    if (gameLaunched) {
      pushLogLine(line);
      return;
    }

    if (!isPreLaunchFailureLine(line)) return;

    launchFailed = true;
    failMessage = line;
    step(onProgress, line.slice(0, 280), undefined, "error");
    emit(onProgress, { stage: "error", message: line });
  };

  launcher.on("progress", (e) => {
    const total = Number(e.total) || 0;
    const current = Number(e.current ?? e.task) || 0;
    const percent = total > 0 ? Math.min(99, Math.round((current / total) * 100)) : null;
    const key = `${e.type}:${current}:${total}`;
    const now = Date.now();
    if (key === lastProgressKey && now - lastProgressAt < 250) return;
    lastProgressKey = key;
    lastProgressAt = now;

    touchProgress({
      stage: "progress",
      type: e.type,
      total,
      current,
      percent,
      message: `${e.type ?? "Descarga"}: ${current}/${total || "?"}`,
    });
  });

  launcher.on("data", (e) => {
    const line = String(e).trim();
    if (!line) return;
    watchLog(line);
    if (!gameLaunched) pushLogLine(line);
  });

  launcher.on("debug", (e) => {
    const line = String(e).trim();
    if (!line) return;
    watchLog(line);
    if (/MCLC|Atlas en caché|Librerías en caché/i.test(line)) {
      step(onProgress, line.replace(/^\[MCLC\]:\s*/, ""), undefined, "ok");
    }
    if (!gameLaunched) pushLogLine(line);
    if (!QUIET_LOG.test(line) || isPreLaunchFailureLine(line)) {
      emit(onProgress, { stage: "debug", message: line.slice(0, 300) });
    }
  });

  launcher.on("close", (code) => {
    stopLatestLogTail();
    tailLatestLog();
    const crashed = typeof code === "number" && code !== 0;
    const crashHint =
      failMessage ||
      readLatestCrashHint(root) ||
      readLatestLogHint(root) ||
      recentLines.filter((l) => isPreLaunchFailureLine(l) || LAUNCH_FATAL.test(l)).pop() ||
      recentLines.slice(-4).join(" · ");
    const failed = gameLaunched ? crashed : launchFailed || (crashed && !gameLaunched);

    emit(onProgress, {
      stage: failed ? "error" : "close",
      code,
      message: failed
        ? formatCrashMessage(code, crashHint, gameLaunched)
        : gameLaunched
          ? "Minecraft cerrado"
          : code === 0
            ? "Minecraft cerrado"
            : "Minecraft cerrado",
    });
    activeClient = null;
  });

  await ensureLegacyForgeClient(root, cfg.mcVersion, cfg.forgeVersion, forgeJar, javaPath, (p) => {
    if (p.message) step(onProgress, p.message, p.detail ? String(p.detail) : undefined, p.level ?? "step");
  });

  const forgeLaunch = resolveForgeLaunchOptions(cfg, root, cacheState, forgeJar);
  if (isModernMcVersion(cfg.mcVersion)) {
    await ensureForgewrapperJar(cacheState.libraryRoot, (p) => {
      if (p.message) step(onProgress, p.message, p.detail ? String(p.detail) : undefined, p.level ?? "step");
    });
    await ensureForgewrapperJar(path.join(root, "libraries"), (p) => {
      if (p.message) step(onProgress, p.message, p.detail ? String(p.detail) : undefined, p.level ?? "step");
    });
  }
  if (forgeLaunch.forge) {
    step(
      onProgress,
      "Forge 1.16+",
      "Generando perfil Forge (instalador + librerías; 3–8 min la primera vez)",
      "info"
    );
  }
  step(onProgress, "Librerías del juego", cacheState.libraryRoot, "info");

  const mcWindow = resolveMinecraftLaunchWindow(opts.launchWindow);
  const mcUsername = await resolveLauncherUsername();
  step(onProgress, "Jugador", mcUsername, "info");

  const launchOpts = {
    authorization: Authenticator.getAuth(mcUsername),
    root,
    javaPath,
    memory: { max: "3072M", min: "512M" },
    version: forgeLaunch.version,
    forge: forgeLaunch.forge,
    window: {
      width: mcWindow.width,
      height: mcWindow.height,
      fullscreen: false,
    },
    overrides: {
      maxSockets: 24,
      assetRoot: cacheState.assetRoot,
      libraryRoot: cacheState.libraryRoot,
      gameDirectory: root,
      cwd: root,
    },
  };

  const libsComplete = essentialLibrariesPresent(cacheState.libraryRoot, cfg.mcVersion);
  emit(onProgress, {
    stage: "downloading",
    message: libsComplete && cacheState.quickLaunch
      ? "Iniciando Minecraft…"
      : "Descargando librerías de Minecraft (Guava, Mojang, Forge…) — puede tardar unos minutos…",
    percent: libsComplete && cacheState.quickLaunch ? 85 : 0,
  });
  step(
    onProgress,
    libsComplete && cacheState.quickLaunch ? "Arranque rápido" : "Sincronizando librerías",
    libsComplete ? cacheState.libraryRoot : "Primera vez: descarga completa",
    libsComplete && cacheState.quickLaunch ? "ok" : "step"
  );

  await setupCraftLauncherClient({
    gameRoot: root,
    mcVersion: cfg.mcVersion,
    libraryRoot: cacheState.libraryRoot,
    instanceId: instance?.id ?? null,
    launchWindow: mcWindow,
    minecraftUsername: mcUsername,
    onProgress: (p) => {
      if (p.message) step(onProgress, p.message, p.detail ? String(p.detail) : undefined, p.level ?? "step");
    },
  });

  applyUiPack({
    gameRoot: root,
    mcVersion: cfg.mcVersion,
    onProgress: (p) => {
      if (p.message) step(onProgress, p.message, p.detail ? String(p.detail) : undefined, p.level ?? "step");
    },
  });

  const preflight = await runPrelaunchChecks({
    gameRoot: root,
    mcVersion: cfg.mcVersion,
    javaPath,
    launchWindow: mcWindow,
    onProgress: (p) => {
      if (p.message) step(onProgress, p.message, p.detail ? String(p.detail) : undefined, p.level ?? "step");
    },
  });

  if (!preflight.ok) {
    throw new Error(preflight.errors.join(" ") || "Verificación pre-lanzamiento fallida");
  }

  const stallTimer = setInterval(() => {
    if (gameLaunched) return;
    if (Date.now() - lastEmitAt < 20_000) return;
    touchProgress({
      stage: "progress",
      message: "Sigue preparando librerías y assets (puede tardar varios minutos la primera vez)…",
    });
  }, 10_000);

  try {
    await launcher.launch(launchOpts);
  } finally {
    clearInterval(stallTimer);
    stopLatestLogTail();
  }

  if (launchFailed && !gameLaunched) {
    throw new Error(failMessage || "Minecraft no pudo iniciarse. Revisa el registro en la ventana de descarga.");
  }

  if (opts.waitForClose !== false && process.env.CRAFTLAUNCHER_WORKER === "1") {
    await new Promise((resolve) => {
      if (!activeClient) {
        resolve();
        return;
      }
      activeClient.once("close", resolve);
    });
  }

  return {
    ok: true,
    message: `${cfg.label} — Minecraft en ejecución`,
    label: cfg.label,
    instanceId: instance?.id ?? null,
    gameDir: root,
  };
}
