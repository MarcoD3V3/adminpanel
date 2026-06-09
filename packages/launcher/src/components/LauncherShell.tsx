import { useEffect, useMemo } from "react";
import {
  backgroundExtendsIntoChrome,
  getActiveScreen,
  hubWindowFrameBackgroundStyle,
  markLauncherFullReload,
  resolveBackgroundChromeStyle,
  resolveLayoutChromeHeight,
} from "@craftlauncher/shared";
import { launcherActions, useLauncherStore } from "@/lib/launcher-store";
import {
  getLauncherApi,
  isDesktopLauncher,
  MINECRAFT_PROGRESS_EVENT,
  onHubNavigate,
  type MinecraftProgressPayload,
} from "@/lib/electron-api";
import { HubChromeBar } from "./HubChromeBar";
import { HubRuntime } from "./HubRuntime";
import { LauncherAlerts } from "./LauncherAlerts";
import { LauncherBanners } from "./LauncherBanners";
import { FloatingAlerts } from "./FloatingAlerts";
import { LaunchProgressPanel } from "./LaunchProgressPanel";
import { ModsPanel } from "./ModsPanel";
import { PlayerSkinPanel } from "./PlayerSkinPanel";
import { useLauncherDataStore } from "@/lib/launcher-data-store";
import { ADMIN_API_URL } from "@/lib/config";

export function LauncherShell() {
  const layout = useLauncherStore((s) => s.layout);
  const loading = useLauncherStore((s) => s.loading);
  const lastSync = useLauncherStore((s) => s.lastSync);
  const panel = useLauncherDataStore((s) => s.panel);
  const desktop = isDesktopLauncher();
  const activeScreen = useMemo(() => getActiveScreen(layout), [layout]);
  const chromeHeight = useMemo(
    () => resolveLayoutChromeHeight(layout, activeScreen.id),
    [layout, activeScreen.id]
  );
  const extendedFrameBg = useMemo(
    () =>
      backgroundExtendsIntoChrome(resolveBackgroundChromeStyle(activeScreen))
        ? hubWindowFrameBackgroundStyle(activeScreen, chromeHeight, "runtime", {
            proxyBaseUrl: ADMIN_API_URL,
          })
        : undefined,
    [activeScreen, chromeHeight]
  );

  useEffect(() => {
    void launcherActions.syncLayout();
    const syncTimer = setInterval(() => void launcherActions.syncLayout(), 60_000);
    return () => clearInterval(syncTimer);
  }, []);

  useEffect(() => {
    const onReloadShortcut = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === "r") {
        markLauncherFullReload();
        return;
      }
      if (key === "f5") {
        markLauncherFullReload();
      }
    };
    window.addEventListener("keydown", onReloadShortcut, true);
    return () => window.removeEventListener("keydown", onReloadShortcut, true);
  }, []);

  useEffect(() => {
    void getLauncherApi()
      ?.getAppInfo()
      .then((info) => {
        if (info?.version) launcherActions.setLauncherVersion(info.version);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void launcherActions.pollNotifications();
    void launcherActions.sendHeartbeat();
    const pollTimer = setInterval(() => void launcherActions.pollNotifications(), 5_000);
    const heartbeatTimer = setInterval(() => void launcherActions.sendHeartbeat(), 15_000);
    return () => {
      clearInterval(pollTimer);
      clearInterval(heartbeatTimer);
    };
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const payload = (event as CustomEvent<MinecraftProgressPayload>).detail;
      if (!payload || typeof payload !== "object") return;
      launcherActions.handleMinecraftProgress(payload);
      useLauncherDataStore.getState().handleInstallProgress(payload as Record<string, unknown>);
    };
    window.addEventListener(MINECRAFT_PROGRESS_EVENT, handler);
    return () => window.removeEventListener(MINECRAFT_PROGRESS_EVENT, handler);
  }, []);

  useEffect(() => {
    return onHubNavigate((screenId) => {
      launcherActions.setActiveScreen(screenId, { recordHistory: false });
    });
  }, []);

  useEffect(() => {
    if (desktop) void useLauncherDataStore.getState().bootstrap();
  }, [desktop]);

  useEffect(() => {
    if (desktop) void launcherActions.restoreLaunchLog();
  }, [desktop]);

  useEffect(() => {
    if (!desktop) return;
    const api = getLauncherApi();
    return api?.onLaunchProgressHidden?.(() => {
      launcherActions.syncLaunchPanelHidden();
    });
  }, [desktop]);

  useEffect(() => {
    if (!desktop) return;
    void launcherActions.applyWindowFromLayout();
  }, [
    desktop,
    layout.window?.width,
    layout.window?.height,
    layout.window?.lockSize,
    layout.window?.borderlessFullscreen,
  ]);

  return (
    <div className="shell">
      <div
        className={extendedFrameBg ? "shell-viewport shell-viewport-extended-bg" : "shell-viewport"}
        style={extendedFrameBg}
      >
        <HubChromeBar />

        <div className="shell-canvas">
          {loading && !lastSync ? (
            <div className="center-msg">Conectando con {ADMIN_API_URL}…</div>
          ) : (
            <HubRuntime />
          )}
        </div>
      </div>

      {!desktop && (
        <div className="desktop-warning" role="alert">
          Modo navegador — Minecraft no funciona aquí. Cierra esta pestaña y abre la app con{" "}
          <strong>npm run launcher:dev</strong> (debe abrirse una ventana sin barra de Chrome/Firefox).
        </div>
      )}

      <LauncherBanners />
      <LauncherAlerts />
      <FloatingAlerts />
      <LaunchProgressPanel />
      {panel === "mods" && <ModsPanel />}
      {panel === "skin" && <PlayerSkinPanel />}
    </div>
  );
}
