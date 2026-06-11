import type {
  CurseForgeModFile,
  CurseForgeModSummary,
  CurseForgeSearchResult,
  FeaturedModpack,
  HubLayout,
  LauncherInstance,
  LauncherSettings,
  ModCatalogTab,
} from "@craftlauncher/shared";
import { parseHubScreenIdFromHash } from "@craftlauncher/shared";

export type HubLayoutCachePayload = {
  version?: number;
  savedAt: string | null;
  fingerprint: string;
  layout: HubLayout;
};

export type MinecraftProgressPayload = {
  stage?: string;
  message?: string;
  type?: string;
  task?: number;
  total?: number;
  current?: number;
  percent?: number;
  code?: number;
  versionLabel?: string;
  level?: string;
  detail?: string;
  time?: string;
};

export type CfDetailsResult = {
  ok: boolean;
  error?: string;
  mod?: CurseForgeModSummary | null;
  files?: CurseForgeModFile[];
  filesError?: string | null;
};

export interface LauncherDesktopApi {
  isDesktop?: boolean;
  platform: string;
  minimize: () => Promise<void>;
  close: () => Promise<void>;
  openAccountWindow?: () => Promise<boolean>;
  openHubScreen?: (screenId: string) => Promise<boolean>;
  navigateMainScreen?: (screenId: string) => Promise<boolean>;
  openLaunchProgress?: () => Promise<boolean>;
  closeLaunchProgress?: () => Promise<boolean>;
  syncLaunchSession?: (session: unknown) => Promise<boolean>;
  onLaunchSession?: (callback: (session: unknown) => void) => () => void;
  onLaunchProgressHidden?: (callback: () => void) => () => void;
  focusMainWindow?: () => Promise<boolean>;
  getAppInfo: () => Promise<{ name: string; version: string; platform: string; mainRev?: string; defaultDataDir?: string }>;
  openExternal: (url: string) => Promise<void>;
  launchMinecraft: (version: string) => Promise<string>;
  launchForge?: (
    versionId: string,
    instanceId?: string | null
  ) => Promise<{ ok?: boolean; started?: boolean; error?: string; message?: string } | string>;
  loadAuth?: () => Promise<{ sessionToken: string; deviceId: string; fingerprint: string } | null>;
  saveAuth?: (data: {
    sessionToken: string;
    deviceId: string;
    fingerprint: string;
    username?: string | null;
  }) => Promise<void>;
  clearAuth?: () => Promise<void>;
  broadcastLogout?: () => Promise<boolean>;
  onAuthLoggedOut?: (callback: () => void) => () => void;
  getSettings?: () => Promise<LauncherSettings>;
  getDisplayWorkArea?: () => Promise<{ width: number; height: number; x: number; y: number }>;
  saveSettings?: (patch: Partial<LauncherSettings>) => Promise<LauncherSettings>;
  pickDataDir?: () => Promise<LauncherSettings | null>;
  listInstances?: () => Promise<{ settings: LauncherSettings; instances: LauncherInstance[] }>;
  createInstance?: (input: Partial<LauncherInstance>) => Promise<LauncherInstance>;
  deleteInstance?: (id: string) => Promise<{ settings: LauncherSettings; instances: LauncherInstance[] }>;
  selectInstance?: (id: string) => Promise<{ settings: LauncherSettings; instances: LauncherInstance[] }>;
  updateInstance?: (id: string, patch: Partial<LauncherInstance>) => Promise<LauncherInstance>;
  getActiveInstance?: () => Promise<{ settings: LauncherSettings; instance: LauncherInstance | null; instances: LauncherInstance[] }>;
  listInstalledGameVersions?: (instanceId?: string) => Promise<{ id: string; label: string }[]>;
  searchMods?: (query: string, opts: Record<string, unknown>) => Promise<CurseForgeSearchResult>;
  searchModpacks?: (query: string, opts: Record<string, unknown>) => Promise<CurseForgeSearchResult>;
  searchResourcePacks?: (query: string, opts: Record<string, unknown>) => Promise<CurseForgeSearchResult>;
  getModDetails?: (modId: number, opts: Record<string, unknown>) => Promise<CfDetailsResult>;
  curseForgeStatus?: () => Promise<{ ok: boolean; reason: string; message: string }>;
  installMod?: (modId: number, opts: Record<string, unknown>) => Promise<{ ok?: boolean; error?: string; path?: string; fileName?: string }>;
  installModpack?: (
    modId: number,
    opts?: { mcVersion?: string; loader?: string }
  ) => Promise<{ ok?: boolean; error?: string; instanceId?: string; gameRoot?: string; modCount?: number }>;
  listInstalledMods?: (
    instanceId: string,
    opts?: { checkUpdates?: boolean; offset?: number; limit?: number }
  ) => Promise<InstalledModRow[] | InstalledModsPageResult>;
  deleteInstalledMod?: (instanceId: string, fileName: string) => Promise<{ ok?: boolean; error?: string }>;
  updateInstalledMod?: (
    instanceId: string,
    fileName: string
  ) => Promise<{ ok?: boolean; error?: string; updated?: boolean; fileName?: string }>;
  setInstalledModEnabled?: (
    instanceId: string,
    fileName: string,
    enabled: boolean
  ) => Promise<{ ok?: boolean; error?: string; fileName?: string; enabled?: boolean }>;
  listResourcePacks?: (instanceId: string) => Promise<{ fileName: string; size: number }[]>;
  instanceStats?: (instanceId: string) => Promise<{ modCount: number; resourcePackCount: number }>;
  saveLaunchLog?: (data: LaunchLogPersistPayload) => Promise<LaunchLogPersistPayload | null>;
  loadLaunchLog?: () => Promise<LaunchLogPersistPayload | null>;
  readHubLayoutCache?: () => Promise<HubLayoutCachePayload | null>;
  writeHubLayoutCache?: (layout: HubLayout) => Promise<HubLayoutCachePayload | null>;
  killMinecraft?: () => Promise<{ ok?: boolean; error?: string }>;
  restartLauncher?: () => Promise<{ ok?: boolean }>;
}

export type InstalledModRow = {
  fileName: string;
  size: number;
  modId?: number;
  fileId?: number;
  displayName?: string;
  disabled?: boolean;
  updateAvailable?: boolean;
  latestFileName?: string;
  latestFileId?: number;
  latestDisplayName?: string;
};

export type InstalledModsPageResult = {
  rows: InstalledModRow[];
  total: number;
  hasMore: boolean;
};

export function isInstalledModsPageResult(
  value: InstalledModRow[] | InstalledModsPageResult
): value is InstalledModsPageResult {
  return Boolean(value && typeof value === "object" && "rows" in value && Array.isArray(value.rows));
}

export type LaunchLogPersistPayload = {
  versionLabel?: string;
  message?: string;
  phase?: string;
  percent?: number | null;
  logs?: string[];
  structuredLogs?: { message: string; detail?: string; level: string }[];
  metrics?: unknown;
};

/** Evento DOM emitido por preload al recibir progreso de Minecraft (IPC → CustomEvent). */
export const MINECRAFT_PROGRESS_EVENT = "craftlauncher:minecraft-progress";

/** Navegación de pantalla Hub desde la ventana principal (IPC → CustomEvent). */
export const HUB_NAVIGATE_EVENT = "craftlauncher:hub-navigate";

declare global {
  interface Window {
    launcher?: LauncherDesktopApi;
  }
}

export function getLauncherApi(): LauncherDesktopApi | null {
  if (typeof window !== "undefined" && window.launcher) return window.launcher;
  return null;
}

export function isDesktopLauncher(): boolean {
  const api = getLauncherApi();
  if (api?.isDesktop || api?.platform) return true;
  if (typeof navigator !== "undefined" && navigator.userAgent.includes("Electron")) {
    return Boolean(api);
  }
  return false;
}

/** Renderer cargado en `#/hub-screen/{id}` (ventana secundaria). */
export function isHubScreenWindow(): boolean {
  if (typeof window === "undefined") return false;
  return parseHubScreenIdFromHash(window.location.hash) != null;
}

export function onHubNavigate(callback: (screenId: string) => void): () => void {
  const handler = (event: Event) => {
    const screenId = String(
      (event as CustomEvent<{ screenId?: string }>).detail?.screenId ?? ""
    ).trim();
    if (screenId) callback(screenId);
  };
  window.addEventListener(HUB_NAVIGATE_EVENT, handler);
  return () => window.removeEventListener(HUB_NAVIGATE_EVENT, handler);
}

export async function openHubScreenWindow(screenId: string): Promise<boolean> {
  const api = getLauncherApi();
  if (!api?.openHubScreen) return false;
  return Boolean(await api.openHubScreen(screenId));
}

export async function navigateMainHubScreen(screenId: string): Promise<boolean> {
  const api = getLauncherApi();
  if (!api?.navigateMainScreen) return false;
  return Boolean(await api.navigateMainScreen(screenId));
}

function desktopLaunchError(): Error {
  if (typeof navigator !== "undefined" && navigator.userAgent.includes("Electron")) {
    return new Error(
      "CraftLauncher no cargó el módulo de juego. Cierra la app por completo y vuelve a ejecutar: npm run launcher:dev"
    );
  }
  return new Error(
    "Estás en el navegador, no en la app de escritorio. Cierra localhost:1420 y ejecuta: npm run launcher:dev"
  );
}

export async function openExternalUrl(url: string) {
  const api = getLauncherApi();
  if (api) {
    await api.openExternal(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function launchForge(versionId: string, instanceId?: string | null) {
  const api = getLauncherApi();
  if (!api) throw desktopLaunchError();
  const launch = api.launchForge ?? api.launchMinecraft;
  if (!launch) throw desktopLaunchError();
  if (api.launchForge) return api.launchForge(versionId, instanceId ?? null);
  return launch.call(api, versionId);
}

export async function launchMinecraft(version: string) {
  return launchForge(version);
}

export function cfClassIdForTab(tab: ModCatalogTab): number | undefined {
  if (tab === "modpacks") return 4471;
  if (tab === "resourcepacks") return 12;
  if (tab === "mods") return 6;
  return undefined;
}
