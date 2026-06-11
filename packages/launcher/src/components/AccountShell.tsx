import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Minimize2, X } from "lucide-react";
import {
  bindAccountHubElements,
  hubScreenBackgroundStyle,
  resolveAccountSurface,
  type HubElement,
  type HubScreen,
} from "@craftlauncher/shared";
import { getAdminApiUrl } from "@/lib/config";
import { launcherActions, useLauncherStore } from "@/lib/launcher-store";
import { useAuthStore } from "@/lib/auth-store";
import { getLauncherApi, openExternalUrl } from "@/lib/electron-api";
import { useLauncherDataStore } from "@/lib/launcher-data-store";
import { HubElementView } from "./HubElementView";
import { PlayerSkinPanel } from "./PlayerSkinPanel";

const CLICKABLE = new Set([
  "play-button",
  "button",
  "nav-item",
  "script-button",
  "counter",
  "icon-button",
  "link",
  "banner",
  "toast-trigger",
  "profile-widget",
]);

function getActiveAccountScreen(screens: HubScreen[], activeScreenId: string) {
  return screens.find((s) => s.id === activeScreenId) ?? screens[0];
}

async function executeAccountAction(el: HubElement) {
  if (el.action === "external" && el.externalUrl) {
    await openExternalUrl(el.externalUrl);
    return;
  }
  if (el.action === "settings") {
    void getLauncherApi()?.close();
    launcherActions.setActiveScreen("screen-settings");
    return;
  }
  if (el.action === "logout") {
    useAuthStore.getState().logout();
    void getLauncherApi()?.focusMainWindow?.();
    void getLauncherApi()?.close();
    return;
  }
  if (el.action === "instances") {
    void getLauncherApi()?.close();
    useLauncherDataStore.getState().openPanel("instances");
    return;
  }
  if (el.action === "mods") {
    void getLauncherApi()?.close();
    useLauncherDataStore.getState().openPanel("mods");
    return;
  }
  if (el.action === "skin") {
    useLauncherDataStore.getState().openPanel("skin");
    return;
  }
  const target = el.targetScreenId;
  if (el.action === "open-screen" && target) {
    return target;
  }
  return null;
}

export function AccountShell() {
  const mainLayout = useLauncherStore((s) => s.layout);
  const displayName = useAuthStore((s) => s.displayName ?? s.username ?? "Usuario");
  const username = useAuthStore((s) => s.username);
  const tier = useAuthStore((s) => s.tier);
  const panel = useLauncherDataStore((s) => s.panel);
  const api = getLauncherApi();

  const surface = useMemo(() => resolveAccountSurface(mainLayout), [mainLayout]);
  const [activeScreenId, setActiveScreenId] = useState(surface.activeScreenId);
  const screen = getActiveAccountScreen(surface.screens, activeScreenId);
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    setActiveScreenId(surface.activeScreenId);
  }, [surface.activeScreenId]);

  useEffect(() => {
    void launcherActions.syncLayout();
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => {
      setScale(Math.min(el.clientWidth / screen.width, el.clientHeight / screen.height, 1));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [screen.width, screen.height]);

  const elements = useMemo(
    () =>
      bindAccountHubElements(screen.elements, {
        displayName,
        username,
        tier,
      }),
    [screen.elements, displayName, username, tier]
  );

  return (
    <div className="shell shell-account">
      <header className="chrome chrome-top">
        <div className="chrome-drag">
          <span className="app-mark">CraftLauncher</span>
          <span className="chrome-screen-title" title={screen.name}>
            {screen.name}
          </span>
        </div>
        <div className="chrome-end">
          <div className="chrome-actions">
            {username && (
              <button
                type="button"
                title="Mi skin"
                onClick={() => useLauncherDataStore.getState().openPanel("skin")}
              >
                <Image size={13} />
              </button>
            )}
            <button type="button" title="Minimizar" onClick={() => void api?.minimize()}>
              <Minimize2 size={13} />
            </button>
            <button type="button" title="Cerrar" className="close" onClick={() => void api?.close()}>
              <X size={13} />
            </button>
          </div>
        </div>
      </header>

      <div ref={stageRef} className="shell-canvas">
        <div className="hub-stage">
          <div
            className="hub-screen"
            style={{
              width: screen.width,
              height: screen.height,
              ...hubScreenBackgroundStyle(screen, "runtime", { proxyBaseUrl: getAdminApiUrl() }),
              transform: `scale(${scale})`,
            }}
          >
            {[...elements]
              .sort((a, b) => a.zIndex - b.zIndex)
              .map((el) => (
                <HubElementView
                  key={el.id}
                  element={el}
                  onClick={
                    CLICKABLE.has(el.type)
                      ? () => {
                          void (async () => {
                            const next = await executeAccountAction(el);
                            if (typeof next === "string") setActiveScreenId(next);
                          })();
                        }
                      : undefined
                  }
                />
              ))}
          </div>
        </div>
      </div>
      {panel === "skin" && <PlayerSkinPanel />}
    </div>
  );
}
