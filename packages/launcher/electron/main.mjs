import { app, BrowserWindow, ipcMain, shell, dialog, screen } from "electron";
import path from "node:path";
import fs from "node:fs";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFile() {
  const candidates = [
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), "../../.env.local"),
    path.join(__dirname, "../../../.env.local"),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
    break;
  }
}

loadEnvFile();

import { LAUNCHER_MAIN_REV } from "./minecraft-launcher.mjs";
import { FORGE_VERSIONS } from "./forge-versions.mjs";
import { loadSettings, saveSettings, setDataDir } from "./launcher-settings.mjs";
import { defaultDataDir, resolveDataDir } from "./launcher-paths.mjs";
import {
  listInstances,
  createInstance,
  deleteInstance,
  selectInstance,
  updateInstance,
  getActiveInstance,
} from "./instances.mjs";
import { listInstalledGameVersions } from "./game-versions.mjs";
import { searchMods, searchModpacks, searchResourcePacks, getModFiles, getModDetails, curseForgeKeyStatus } from "./curseforge.mjs";
import {
  installModToActiveInstance,
  installModpackToActiveInstance,
  listInstalledMods,
  listInstalledResourcePacks,
  getInstanceContentStats,
  deleteInstalledMod,
  updateInstalledMod,
  setInstalledModEnabled,
} from "./mod-installer.mjs";
import { saveLaunchLog, loadLaunchLog } from "./launch-log-persist.mjs";
import { readHubLayoutCache, writeHubLayoutCache } from "./hub-layout-cache.mjs";
import { startUiBridge } from "./ui-bridge.mjs";

function isLaunchDesktopWindowEnabled() {
  try {
    return Boolean(readHubLayoutCache()?.layout?.ui?.launchDesktopWindow);
  } catch {
    return false;
  }
}

function maybeOpenLaunchProgressWindow() {
  if (!isLaunchDesktopWindowEnabled()) return;
  ensureLaunchProgressWindow();
}

const isDev = !app.isPackaged;

function authFilePath() {
  return path.join(app.getPath("userData"), "launcher-auth.json");
}

function readAuthFile() {
  try {
    return JSON.parse(fs.readFileSync(authFilePath(), "utf-8"));
  } catch {
    return null;
  }
}

function writeAuthFile(data) {
  fs.mkdirSync(path.dirname(authFilePath()), { recursive: true });
  fs.writeFileSync(authFilePath(), JSON.stringify(data, null, 2), "utf-8");
}

/** @type {BrowserWindow | null} */
let mainWindow = null;

/** @type {BrowserWindow | null} */
let accountWindow = null;

/** @type {BrowserWindow | null} */
let launchProgressWindow = null;

/** @type {Map<string, BrowserWindow>} */
const hubScreenWindows = new Map();

const HUB_SCREEN_CHROME_H = 40;

function hubScreenWindowHash(screenId) {
  return `#/hub-screen/${encodeURIComponent(screenId)}`;
}

function resolveHubScreenFromCache(screenId) {
  const layout = readHubLayoutCache()?.layout;
  return layout?.screens?.find((s) => s.id === screenId) ?? null;
}

function resolveHubChromeHeightFromCache() {
  const chromeH = readHubLayoutCache()?.layout?.launcherChrome?.height;
  const n = Number(chromeH);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : HUB_SCREEN_CHROME_H;
}

function openHubScreenWindow(screenId) {
  const screen = resolveHubScreenFromCache(screenId);
  if (!screen) return false;

  let win = hubScreenWindows.get(screenId);
  if (win && !win.isDestroyed()) {
    win.focus();
    return true;
  }

  const chromeH = resolveHubChromeHeightFromCache();
  const w = Math.max(320, Math.round(Number(screen.width) || 980));
  const h = Math.max(240, Math.round(Number(screen.height) || 480) + chromeH);

  win = new BrowserWindow({
    width: w,
    height: h,
    minWidth: 320,
    minHeight: chromeH + 120,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    title: "CraftLauncher",
    backgroundColor: screen.backgroundColor || "#0c0e11",
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      partition: "persist:craftlauncher",
    },
  });

  win.once("ready-to-show", () => win?.show());
  loadRendererWindow(win, hubScreenWindowHash(screenId));
  hubScreenWindows.set(screenId, win);
  win.on("closed", () => hubScreenWindows.delete(screenId));
  return true;
}

function navigateMainHubScreen(screenId) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("hub:navigate", { screenId: String(screenId) });
    mainWindow.show();
    mainWindow.focus();
    return true;
  }
  return false;
}

/** @type {object | null} */
let lastLaunchSessionSnapshot = null;

function resolvePrimaryWorkArea() {
  const display = screen.getPrimaryDisplay();
  const { width, height, x, y } = display.workArea;
  return {
    width: Math.round(width),
    height: Math.round(height),
    x: Math.round(x),
    y: Math.round(y),
  };
}

function applyWindowSettings(win, settings) {
  if (!win || win.isDestroyed()) return;

  if (settings?.window?.borderlessFullscreen) {
    const area = resolvePrimaryWorkArea();
    win.setResizable(false);
    win.setMinimumSize(area.width, area.height);
    win.setMaximumSize(area.width, area.height);
    win.setBounds({ x: area.x, y: area.y, width: area.width, height: area.height });
    return;
  }

  const w = Number(settings?.window?.width);
  const h = Number(settings?.window?.height);
  const lock = Boolean(settings?.window?.lockSize);
  const hasSize = Number.isFinite(w) && Number.isFinite(h) && w >= 320 && h >= 200;

  if (hasSize) {
    win.setResizable(true);
    win.setSize(Math.round(w), Math.round(h));
    if (lock) {
      win.setMinimumSize(Math.round(w), Math.round(h));
      win.setMaximumSize(Math.round(w), Math.round(h));
    } else {
      win.setMinimumSize(320, 200);
      win.setMaximumSize(10000, 10000);
    }
  } else if (!lock) {
    win.setMinimumSize(320, 200);
    win.setMaximumSize(10000, 10000);
  }

  win.setResizable(!lock);
}

function sanitizeProgressPayload(payload) {
  try {
    return JSON.parse(JSON.stringify(payload ?? {}));
  } catch {
    return { stage: "log", message: String(payload?.message ?? "progress") };
  }
}

/** Garantiza que las respuestas IPC sean clonables en el renderer. */
function ipcJson(value) {
  try {
    return JSON.parse(JSON.stringify(value ?? null));
  } catch {
    return null;
  }
}

async function cfIpc(fn, fallback = {}) {
  try {
    return ipcJson(await fn());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return ipcJson({ ok: false, error: message, ...fallback });
  }
}

const progressThrottle = new Map();
const PROGRESS_FLUSH_MS = 300;
const BATCH_STAGES = new Set(["progress", "log", "debug", "install-log"]);

/** @type {import("node:child_process").ChildProcess | null} */
let activeLaunchWorker = null;

function progressTargetWindows(primaryWin) {
  const targets = [];
  const seen = new Set();
  const add = (w) => {
    if (!w || w.isDestroyed() || seen.has(w.id)) return;
    seen.add(w.id);
    targets.push(w);
  };
  add(primaryWin);
  add(mainWindow);
  add(launchProgressWindow);
  return targets;
}

function broadcastProgress(wins, payload) {
  for (const win of wins) {
    win.webContents.send("minecraft:progress", payload);
  }
}

function flushPendingProgress(senderId) {
  const state = progressThrottle.get(senderId);
  if (!state?.pending || !state.targets?.length) return;
  broadcastProgress(state.targets, state.pending);
  state.pending = null;
}

function isLaunchWorkerActive() {
  return Boolean(
    activeLaunchWorker && activeLaunchWorker.exitCode == null && !activeLaunchWorker.killed
  );
}

function sendProgress(event, payload) {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;

  const safe = sanitizeProgressPayload(payload);
  const stage = safe.stage ?? "";
  const senderId = event.sender.id;
  const targets = progressTargetWindows(win);

  if (
    isLaunchWorkerActive() &&
    (stage === "checking" ||
      stage === "start" ||
      stage === "downloading" ||
      stage === "progress" ||
      stage === "error" ||
      stage === "launched" ||
      stage === "starting")
  ) {
    maybeOpenLaunchProgressWindow();
  }

  if (BATCH_STAGES.has(stage)) {
    let state = progressThrottle.get(senderId);
    if (!state) {
      state = { targets, pending: null, timer: null };
      state.timer = setInterval(() => flushPendingProgress(senderId), PROGRESS_FLUSH_MS);
      progressThrottle.set(senderId, state);
    }
    state.targets = targets;
    state.pending = safe;
    return;
  }

  flushPendingProgress(senderId);
  broadcastProgress(targets, safe);

  if (stage === "close" || stage === "error" || stage === "launched" || stage === "starting") {
    const state = progressThrottle.get(senderId);
    if (state?.timer) clearInterval(state.timer);
    progressThrottle.delete(senderId);
  }
}

function sendLaunchSession(session) {
  if (session && typeof session === "object") {
    lastLaunchSessionSnapshot = session;
  }
  const payload = ipcJson(session);
  if (!payload) return;
  if (launchProgressWindow && !launchProgressWindow.isDestroyed()) {
    launchProgressWindow.webContents.send("launch:session", payload);
  }
}

function hideLaunchProgressWindow() {
  if (launchProgressWindow && !launchProgressWindow.isDestroyed()) {
    launchProgressWindow.hide();
  }
}

function notifyMainLaunchProgressHidden() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("launch:progressHidden");
  }
}

function ensureLaunchProgressWindow() {
  if (launchProgressWindow && !launchProgressWindow.isDestroyed()) {
    if (!launchProgressWindow.isVisible()) launchProgressWindow.show();
    return launchProgressWindow;
  }

  launchProgressWindow = new BrowserWindow({
    width: 520,
    height: 480,
    minWidth: 400,
    minHeight: 360,
    show: false,
    frame: false,
    resizable: true,
    backgroundColor: "#0c0e11",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      partition: "persist:craftlauncher",
    },
  });

  launchProgressWindow.on("close", (event) => {
    event.preventDefault();
    hideLaunchProgressWindow();
    notifyMainLaunchProgressHidden();
  });

  launchProgressWindow.once("ready-to-show", () => launchProgressWindow?.show());
  launchProgressWindow.webContents.once("did-finish-load", () => {
    if (lastLaunchSessionSnapshot) sendLaunchSession(lastLaunchSessionSnapshot);
  });
  loadRendererWindow(launchProgressWindow, "#/launch");
  return launchProgressWindow;
}

function resolveLaunchWindowSize() {
  const area = screen.getPrimaryDisplay().workAreaSize;
  return {
    width: Math.max(854, Math.round(area.width)),
    height: Math.max(480, Math.round(area.height)),
  };
}

function startLaunchInBackground(event, versionId, instanceId = null) {
  if (activeLaunchWorker && activeLaunchWorker.exitCode == null && !activeLaunchWorker.killed) {
    sendProgress(event, { stage: "error", message: "Ya hay un lanzamiento en curso" });
    return;
  }

  const settings = loadSettings();
  const dataDir = resolveDataDir(settings.dataDir);
  const workerPath = path.join(__dirname, "launch-worker.mjs");
  const launchWindow = resolveLaunchWindowSize();

  activeLaunchWorker = fork(workerPath, [], {
    execPath: process.execPath,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      CRAFTLAUNCHER_WORKER: "1",
      CRAFTLAUNCHER_USER_DATA: app.getPath("userData"),
      CRAFTLAUNCHER_DATA_DIR: dataDir,
    },
    stdio: ["pipe", "pipe", "pipe", "ipc"],
  });

  activeLaunchWorker.on("message", (msg) => {
    if (msg?.type === "progress") sendProgress(event, msg.payload);
    if (msg?.type === "done") activeLaunchWorker = null;
  });

  activeLaunchWorker.on("error", (err) => {
    sendProgress(event, {
      stage: "error",
      message: err instanceof Error ? err.message : String(err),
    });
    activeLaunchWorker = null;
  });

  activeLaunchWorker.on("exit", (code, signal) => {
    if (code !== 0 && code !== null) {
      sendProgress(event, {
        stage: "error",
        message: `El proceso de lanzamiento terminó inesperadamente (código ${code}${signal ? `, ${signal}` : ""})`,
      });
    }
    activeLaunchWorker = null;
  });

  activeLaunchWorker.stderr?.on("data", (chunk) => {
    const line = String(chunk).trim();
    if (line) console.error("[launch-worker]", line);
  });

  activeLaunchWorker.send({
    type: "launch",
    versionId,
    instanceId,
    userData: app.getPath("userData"),
    launchWindow,
  });
}

function loadRendererWindow(win, hash = "") {
  const suffix = hash ? (hash.startsWith("#") ? hash : `#${hash}`) : "";
  if (isDev) {
    void win.loadURL(`http://localhost:1420/${suffix}`);
  } else {
    void win.loadFile(path.join(__dirname, "../dist/index.html"), {
      hash: suffix.replace(/^#/, ""),
    });
  }
}

function createAccountWindow() {
  if (accountWindow && !accountWindow.isDestroyed()) {
    accountWindow.focus();
    return;
  }

  const settings = loadSettings();
  accountWindow = new BrowserWindow({
    width: Number(settings?.window?.width) || 920,
    height: Number(settings?.window?.height) || 640,
    minWidth: 720,
    minHeight: 520,
    parent: mainWindow ?? undefined,
    show: false,
    frame: false,
    backgroundColor: "#0c0e11",
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      partition: "persist:craftlauncher",
    },
  });

  accountWindow.once("ready-to-show", () => accountWindow?.show());
  applyWindowSettings(accountWindow, settings);
  loadRendererWindow(accountWindow, "#/account");
  accountWindow.on("closed", () => {
    accountWindow = null;
  });
}

function createWindow() {
  const settings = loadSettings();
  const borderless = Boolean(settings?.window?.borderlessFullscreen);
  const workArea = borderless ? resolvePrimaryWorkArea() : null;
  const initW = workArea?.width ?? Number(settings?.window?.width);
  const initH = workArea?.height ?? Number(settings?.window?.height);
  const lockInit = borderless || Boolean(settings?.window?.lockSize);
  mainWindow = new BrowserWindow({
    x: workArea?.x,
    y: workArea?.y,
    width: Number.isFinite(initW) && initW >= 320 ? initW : 1200,
    height: Number.isFinite(initH) && initH >= 200 ? initH : 720,
    minWidth: lockInit && Number.isFinite(initW) ? initW : 320,
    minHeight: lockInit && Number.isFinite(initH) ? initH : 200,
    show: false,
    frame: false,
    backgroundColor: "#0c0e11",
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      partition: "persist:craftlauncher",
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  applyWindowSettings(mainWindow, settings);

  if (isDev && process.env.CRAFTLAUNCHER_OPEN_DEVTOOLS === "1") {
    mainWindow.webContents.once("did-finish-load", () => {
      mainWindow?.webContents.openDevTools({ mode: "detach" });
    });
  }

  if (isDev) {
    mainWindow.webContents.on("did-fail-load", (_event, code, desc) => {
      console.error("[CraftLauncher] did-fail-load", code, desc);
      void dialog.showMessageBox(mainWindow, {
        type: "error",
        title: "CraftLauncher",
        message: "No se pudo cargar la interfaz (Vite)",
        detail:
          `Error ${code}: ${desc}\n\n` +
          "Cierra todas las ventanas del launcher y ejecuta de nuevo:\n  npm run launcher:dev\n\n" +
          "Si el puerto 1420 estaba ocupado, el script free-port debería liberarlo automáticamente.",
      });
    });
    loadRendererWindow(mainWindow);
  } else {
    loadRendererWindow(mainWindow);
  }

  mainWindow.on("closed", () => {
    if (launchProgressWindow && !launchProgressWindow.isDestroyed()) {
      launchProgressWindow.removeAllListeners("close");
      launchProgressWindow.destroy();
      launchProgressWindow = null;
    }
    for (const [id, win] of hubScreenWindows) {
      if (!win.isDestroyed()) win.destroy();
      hubScreenWindows.delete(id);
    }
    mainWindow = null;
  });
}

ipcMain.handle("window:minimize", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});
ipcMain.handle("window:close", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return;
  if (
    launchProgressWindow &&
    !launchProgressWindow.isDestroyed() &&
    win.id === launchProgressWindow.id
  ) {
    hideLaunchProgressWindow();
    notifyMainLaunchProgressHidden();
    return;
  }
  win.close();
});
ipcMain.handle("window:focusMain", () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  }
  mainWindow?.show();
  mainWindow?.focus();
  return true;
});
ipcMain.handle("window:openAccount", () => {
  createAccountWindow();
  return true;
});
ipcMain.handle("hub:openScreen", (_event, screenId) => ipcJson(openHubScreenWindow(String(screenId ?? ""))));
ipcMain.handle("hub:navigateMain", (_event, screenId) => ipcJson(navigateMainHubScreen(String(screenId ?? ""))));
ipcMain.handle("launch:openProgress", () => {
  if (!isLaunchDesktopWindowEnabled()) return false;
  ensureLaunchProgressWindow();
  launchProgressWindow?.focus();
  return true;
});
ipcMain.handle("launch:closeProgress", () => {
  hideLaunchProgressWindow();
  return true;
});
ipcMain.handle("launch:syncSession", (_event, session) => {
  const shouldShow =
    session &&
    typeof session === "object" &&
    session.phase !== "idle" &&
    session.visible === true;
  if (shouldShow && isLaunchDesktopWindowEnabled()) {
    ensureLaunchProgressWindow();
  } else if (
    launchProgressWindow &&
    !launchProgressWindow.isDestroyed() &&
    launchProgressWindow.isVisible()
  ) {
    hideLaunchProgressWindow();
    notifyMainLaunchProgressHidden();
  }
  sendLaunchSession(session);
  return true;
});

ipcMain.handle("app:getInfo", () =>
  ipcJson({
    name: "CraftLauncher",
    version: app.getVersion(),
    platform: process.platform,
    mainRev: LAUNCHER_MAIN_REV,
    defaultDataDir: defaultDataDir(),
  })
);

ipcMain.handle("liveops:killGame", () => {
  if (activeLaunchWorker && activeLaunchWorker.exitCode == null && !activeLaunchWorker.killed) {
    activeLaunchWorker.kill("SIGTERM");
    activeLaunchWorker = null;
    return ipcJson({ ok: true });
  }
  return ipcJson({ ok: false, error: "No hay Minecraft en ejecución" });
});

ipcMain.handle("liveops:restart", () => {
  app.relaunch();
  app.exit(0);
  return ipcJson({ ok: true });
});

ipcMain.handle("app:openExternal", async (_event, url) => {
  await shell.openExternal(url);
});

ipcMain.handle("minecraft:launchForge", (event, versionId, instanceId) => {
  startLaunchInBackground(event, versionId, instanceId ?? null);
  return ipcJson({ ok: true, started: true });
});

ipcMain.handle("app:launchMinecraft", (event, version) => {
  const cfg = FORGE_VERSIONS.find((v) => v.id === version || v.mcVersion === version);
  if (cfg) {
    startLaunchInBackground(event, cfg.id);
    return ipcJson({ ok: true, started: true, message: "Lanzamiento iniciado" });
  }
  return `Minecraft ${version} — usa el selector Forge para iniciar`;
});

ipcMain.handle("auth:load", () => ipcJson(readAuthFile()));
ipcMain.handle("auth:save", (_event, data) => {
  writeAuthFile(data);
  return true;
});
ipcMain.handle("auth:clear", () => {
  try {
    fs.unlinkSync(authFilePath());
  } catch {
    /* no file */
  }
  return true;
});

function broadcastAuthLoggedOut() {
  try {
    fs.unlinkSync(authFilePath());
  } catch {
    /* no file */
  }

  if (accountWindow && !accountWindow.isDestroyed()) {
    accountWindow.close();
    accountWindow = null;
  }
  for (const [id, win] of hubScreenWindows) {
    if (!win.isDestroyed()) win.close();
    hubScreenWindows.delete(id);
  }

  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send("auth:loggedOut");
    }
  }

  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  }
  mainWindow?.show();
  mainWindow?.focus();
  return true;
}

ipcMain.handle("auth:broadcastLogout", () => broadcastAuthLoggedOut());

// —— Settings & paths ——
ipcMain.handle("launcher:getSettings", () => ipcJson(loadSettings()));
ipcMain.handle("launcher:getDisplayWorkArea", () => ipcJson(resolvePrimaryWorkArea()));
ipcMain.handle("launcher:saveSettings", (_event, patch) => {
  const current = loadSettings();
  const next = saveSettings({ ...current, ...patch });
  applyWindowSettings(mainWindow, next);
  applyWindowSettings(accountWindow, next);
  return ipcJson(next);
});

ipcMain.handle("launcher:readHubLayoutCache", () => {
  try {
    return ipcJson(readHubLayoutCache());
  } catch {
    return null;
  }
});

ipcMain.handle("launcher:writeHubLayoutCache", (_event, layout) => {
  try {
    return ipcJson(writeHubLayoutCache(layout));
  } catch {
    return null;
  }
});
ipcMain.handle("launcher:pickDataDir", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Carpeta de datos CraftLauncher",
    properties: ["openDirectory", "createDirectory"],
    defaultPath: loadSettings().dataDir || defaultDataDir(),
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return ipcJson(setDataDir(result.filePaths[0]));
});

// —— Instances ——
ipcMain.handle("launcher:listInstances", () => ipcJson(listInstances()));
ipcMain.handle("launcher:createInstance", (_event, input) => ipcJson(createInstance(input)));
ipcMain.handle("launcher:deleteInstance", (_event, id) => ipcJson(deleteInstance(id)));
ipcMain.handle("launcher:selectInstance", (_event, id) => ipcJson(selectInstance(id)));
ipcMain.handle("launcher:updateInstance", (_event, id, patch) => ipcJson(updateInstance(id, patch)));
ipcMain.handle("launcher:getActiveInstance", () => ipcJson(getActiveInstance()));
ipcMain.handle("launcher:listInstalledGameVersions", (_event, instanceId) =>
  ipcJson(listInstalledGameVersions(instanceId))
);

ipcMain.handle("launcher:saveLaunchLog", (_event, data) => {
  try {
    return ipcJson(saveLaunchLog(app.getPath("userData"), data));
  } catch {
    return null;
  }
});
ipcMain.handle("launcher:loadLaunchLog", () => {
  try {
    return ipcJson(loadLaunchLog(app.getPath("userData")));
  } catch {
    return null;
  }
});

// —— CurseForge & mods ——
ipcMain.handle("curseforge:status", () => ipcJson(curseForgeKeyStatus()));
ipcMain.handle("curseforge:searchMods", (_event, query, opts) =>
  cfIpc(() => searchMods(query, opts), { mods: [] })
);
ipcMain.handle("curseforge:searchModpacks", (_event, query, opts) =>
  cfIpc(() => searchModpacks(query, opts), { mods: [] })
);
ipcMain.handle("curseforge:searchResourcePacks", (_event, query, opts) =>
  cfIpc(() => searchResourcePacks(query, opts), { mods: [] })
);
ipcMain.handle("curseforge:getModDetails", (_event, modId, opts) =>
  cfIpc(() => getModDetails(modId, opts), { mod: null, files: [] })
);
ipcMain.handle("curseforge:getModFiles", (_event, modId, opts) =>
  cfIpc(async () => ({ ok: true, files: await getModFiles(modId, opts) }), { files: [] })
);
ipcMain.handle("mods:install", async (event, modId, opts) => {
  const send = (p) => sendProgress(event, p);
  return cfIpc(async () => {
    const result = await installModToActiveInstance(modId, opts, send);
    send({ stage: "install-done", message: "Instalación completada" });
    return { ok: true, ...result };
  });
});
ipcMain.handle("mods:installModpack", async (event, modId, opts) => {
  const send = (p) => sendProgress(event, p);
  return cfIpc(async () => {
    const result = await installModpackToActiveInstance(modId, opts ?? {}, send);
    send({ stage: "install-done", message: "Modpack instalado" });
    return { ok: true, ...result };
  });
});
ipcMain.handle("mods:listInstalled", async (_event, instanceId, opts) =>
  ipcJson(await listInstalledMods(instanceId, opts ?? {}))
);
ipcMain.handle("mods:deleteInstalled", (_event, instanceId, fileName) =>
  cfIpc(() => deleteInstalledMod(instanceId, fileName))
);
ipcMain.handle("mods:updateInstalled", async (event, instanceId, fileName) => {
  const send = (p) => sendProgress(event, p);
  return cfIpc(async () => {
    const result = await updateInstalledMod(instanceId, fileName, send);
    send({ stage: "install-done", message: "Actualización completada" });
    return { ok: true, ...result };
  });
});
ipcMain.handle("mods:setInstalledEnabled", (_event, instanceId, fileName, enabled) =>
  cfIpc(() => setInstalledModEnabled(instanceId, fileName, enabled))
);
ipcMain.handle("mods:listResourcePacks", async (_event, instanceId) =>
  ipcJson(await listInstalledResourcePacks(instanceId))
);
ipcMain.handle("mods:instanceStats", async (_event, instanceId) =>
  ipcJson(await getInstanceContentStats(instanceId))
);

app.whenReady().then(() => {
  console.log(`[CraftLauncher] Electron main ${LAUNCHER_MAIN_REV}`);
  createWindow();
  startUiBridge();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
