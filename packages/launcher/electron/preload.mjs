import { contextBridge, ipcRenderer } from "electron";

/** No pasar callbacks renderer→preload: contextBridge usa structuredClone y falla con funciones. */
export const MINECRAFT_PROGRESS_EVENT = "craftlauncher:minecraft-progress";
export const HUB_NAVIGATE_EVENT = "craftlauncher:hub-navigate";

function sanitizeProgressPayload(payload) {
  try {
    return JSON.parse(JSON.stringify(payload ?? {}));
  } catch {
    return { stage: "log", message: String(payload?.message ?? "progress") };
  }
}

ipcRenderer.on("minecraft:progress", (_event, payload) => {
  window.dispatchEvent(
    new CustomEvent(MINECRAFT_PROGRESS_EVENT, { detail: sanitizeProgressPayload(payload) })
  );
});

ipcRenderer.on("hub:navigate", (_event, payload) => {
  window.dispatchEvent(new CustomEvent(HUB_NAVIGATE_EVENT, { detail: payload ?? {} }));
});

contextBridge.exposeInMainWorld("launcher", {
  isDesktop: true,
  platform: process.platform,
  minimize: () => ipcRenderer.invoke("window:minimize"),
  close: () => ipcRenderer.invoke("window:close"),
  focusMainWindow: () => ipcRenderer.invoke("window:focusMain"),
  openAccountWindow: () => ipcRenderer.invoke("window:openAccount"),
  openHubScreen: (screenId) => ipcRenderer.invoke("hub:openScreen", screenId),
  navigateMainScreen: (screenId) => ipcRenderer.invoke("hub:navigateMain", screenId),
  openLaunchProgress: () => ipcRenderer.invoke("launch:openProgress"),
  closeLaunchProgress: () => ipcRenderer.invoke("launch:closeProgress"),
  syncLaunchSession: (session) => ipcRenderer.invoke("launch:syncSession", session),
  onLaunchSession: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("launch:session", handler);
    return () => ipcRenderer.removeListener("launch:session", handler);
  },
  onLaunchProgressHidden: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("launch:progressHidden", handler);
    return () => ipcRenderer.removeListener("launch:progressHidden", handler);
  },
  getAppInfo: () => ipcRenderer.invoke("app:getInfo"),
  openExternal: (url) => ipcRenderer.invoke("app:openExternal", url),
  launchMinecraft: (version) => ipcRenderer.invoke("app:launchMinecraft", version),
  launchForge: (versionId, instanceId) =>
    ipcRenderer.invoke("minecraft:launchForge", versionId, instanceId ?? null),
  loadAuth: () => ipcRenderer.invoke("auth:load"),
  saveAuth: (data) => ipcRenderer.invoke("auth:save", data),
  clearAuth: () => ipcRenderer.invoke("auth:clear"),
  getSettings: () => ipcRenderer.invoke("launcher:getSettings"),
  getDisplayWorkArea: () => ipcRenderer.invoke("launcher:getDisplayWorkArea"),
  saveSettings: (patch) => ipcRenderer.invoke("launcher:saveSettings", patch),
  pickDataDir: () => ipcRenderer.invoke("launcher:pickDataDir"),
  listInstances: () => ipcRenderer.invoke("launcher:listInstances"),
  createInstance: (input) => ipcRenderer.invoke("launcher:createInstance", input),
  deleteInstance: (id) => ipcRenderer.invoke("launcher:deleteInstance", id),
  selectInstance: (id) => ipcRenderer.invoke("launcher:selectInstance", id),
  updateInstance: (id, patch) => ipcRenderer.invoke("launcher:updateInstance", id, patch),
  getActiveInstance: () => ipcRenderer.invoke("launcher:getActiveInstance"),
  listInstalledGameVersions: (instanceId) =>
    ipcRenderer.invoke("launcher:listInstalledGameVersions", instanceId),
  searchMods: (query, opts) => ipcRenderer.invoke("curseforge:searchMods", query, opts),
  searchModpacks: (query, opts) => ipcRenderer.invoke("curseforge:searchModpacks", query, opts),
  searchResourcePacks: (query, opts) => ipcRenderer.invoke("curseforge:searchResourcePacks", query, opts),
  getModDetails: (modId, opts) => ipcRenderer.invoke("curseforge:getModDetails", modId, opts),
  curseForgeStatus: () => ipcRenderer.invoke("curseforge:status"),
  getModFiles: (modId, opts) => ipcRenderer.invoke("curseforge:getModFiles", modId, opts),
  installMod: (modId, opts) => ipcRenderer.invoke("mods:install", modId, opts),
  installModpack: (modId, opts) => ipcRenderer.invoke("mods:installModpack", modId, opts),
  listInstalledMods: (instanceId, opts) => ipcRenderer.invoke("mods:listInstalled", instanceId, opts),
  deleteInstalledMod: (instanceId, fileName) => ipcRenderer.invoke("mods:deleteInstalled", instanceId, fileName),
  updateInstalledMod: (instanceId, fileName) => ipcRenderer.invoke("mods:updateInstalled", instanceId, fileName),
  setInstalledModEnabled: (instanceId, fileName, enabled) =>
    ipcRenderer.invoke("mods:setInstalledEnabled", instanceId, fileName, enabled),
  saveLaunchLog: (data) => ipcRenderer.invoke("launcher:saveLaunchLog", data),
  loadLaunchLog: () => ipcRenderer.invoke("launcher:loadLaunchLog"),
  readHubLayoutCache: () => ipcRenderer.invoke("launcher:readHubLayoutCache"),
  writeHubLayoutCache: (layout) => ipcRenderer.invoke("launcher:writeHubLayoutCache", layout),
  killMinecraft: () => ipcRenderer.invoke("liveops:killGame"),
  restartLauncher: () => ipcRenderer.invoke("liveops:restart"),
});
