import fs from "node:fs";
import {
  defaultDataDir,
  readBootstrap,
  resolveDataDir,
  settingsPath,
  writeBootstrap,
} from "./launcher-paths.mjs";

const DEFAULT_SETTINGS = () => ({
  dataDir: defaultDataDir(),
  activeInstanceId: null,
  loadingScreen: {
    enabled: false,
    backgroundColor: "#3f3f3f",
    progressColor: "#6b9e78",
    progressTrackColor: "#1a1d22",
    brandText: "CraftLauncher",
    brandColor: "#8b8d92",
    hideMojangLogo: true,
    progressHeight: 3,
    progressWidthRatio: 0.42,
  },
  clientFork: {
    enabled: true,
  },
  uiPack: {
    enabled: true,
  },
  updatedAt: new Date().toISOString(),
});

export function loadSettings() {
  const bootstrap = readBootstrap();
  const dataDir = resolveDataDir(bootstrap.dataDir);
  const file = settingsPath(dataDir);

  if (!fs.existsSync(file)) {
    const settings = { ...DEFAULT_SETTINGS(), dataDir };
    saveSettings(settings);
    return settings;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
    return {
      ...DEFAULT_SETTINGS(),
      ...parsed,
      dataDir: resolveDataDir(parsed.dataDir || dataDir),
    };
  } catch {
    const settings = { ...DEFAULT_SETTINGS(), dataDir };
    saveSettings(settings);
    return settings;
  }
}

export function saveSettings(settings) {
  const dataDir = resolveDataDir(settings.dataDir);
  const payload = {
    ...settings,
    dataDir,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(settingsPath(dataDir), JSON.stringify(payload, null, 2), "utf-8");
  writeBootstrap({ dataDir });
  return payload;
}

export function setDataDir(newDir) {
  const current = loadSettings();
  return saveSettings({ ...current, dataDir: newDir });
}

export function setActiveInstance(instanceId) {
  const current = loadSettings();
  return saveSettings({ ...current, activeInstanceId: instanceId });
}

export function getActiveInstanceId() {
  return loadSettings().activeInstanceId;
}
