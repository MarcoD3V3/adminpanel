"use client";

import { useEffect, useLayoutEffect, useMemo } from "react";
import {
  backgroundExtendsIntoChrome,
  hubWindowFrameBackgroundStyle,
  parseHubScreenIdFromHash,
  resolveBackgroundChromeStyle,
  resolveLayoutChromeHeight,
} from "@craftlauncher/shared";
import { getAdminApiUrl } from "@/lib/config";
import { launcherActions, useLauncherStore } from "@/lib/launcher-store";
import { isDesktopLauncher } from "@/lib/electron-api";
import { HubChromeBar } from "./HubChromeBar";
import { HubRuntime } from "./HubRuntime";
import { FloatingAlerts } from "./FloatingAlerts";

export function HubScreenShell() {
  const screenId =
    typeof window !== "undefined" ? parseHubScreenIdFromHash(window.location.hash) : null;
  const layout = useLauncherStore((s) => s.layout);
  const screen = useMemo(
    () => (screenId ? layout.screens.find((sc) => sc.id === screenId) ?? null : null),
    [layout, screenId]
  );
  const desktop = isDesktopLauncher();
  const chromeHeight = useMemo(
    () => (screen ? resolveLayoutChromeHeight(layout, screen.id) : 0),
    [layout, screen]
  );
  const extendedFrameBg = useMemo(() => {
    if (!screen) return undefined;
    if (!backgroundExtendsIntoChrome(resolveBackgroundChromeStyle(screen))) return undefined;
    return hubWindowFrameBackgroundStyle(screen, chromeHeight, "runtime", {
      proxyBaseUrl: getAdminApiUrl(),
    });
  }, [screen, chromeHeight]);

  useEffect(() => {
    void launcherActions.syncLayout();
  }, []);

  useLayoutEffect(() => {
    if (!screenId) return;
    launcherActions.setActiveScreen(screenId, { recordHistory: false });
  }, [screenId]);

  if (!screenId || !screen) {
    return (
      <div className="shell">
        <p className="center-msg">Pantalla no encontrada</p>
      </div>
    );
  }

  return (
    <div className="shell">
      <div
        className={extendedFrameBg ? "shell-viewport shell-viewport-extended-bg" : "shell-viewport"}
        style={extendedFrameBg}
      >
        <HubChromeBar screenId={screenId} />

        <div className="shell-canvas">
          <HubRuntime screenId={screenId} />
        </div>
      </div>

      {!desktop && (
        <div className="desktop-warning" role="alert">
          Modo navegador — abre la app con <strong>npm run launcher:dev</strong>.
        </div>
      )}

      <FloatingAlerts />
    </div>
  );
}
