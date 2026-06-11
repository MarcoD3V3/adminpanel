import { useEffect, useMemo, useRef, useState } from "react";
import {
  bindAccountHubElements,
  elementAbsolutePosition,
  getActiveScreen,
  compileHubAdvancedCssSheet,
  hubElementCssToStyle,
  hubScreenContentBackgroundStyle,
  hubVisualRootProps,
  LAUNCH_UI_ELEMENT_TYPES,
  resolveHubBackgroundColor,
  resolveHubViewport,
  resolveSurfaceBoxShellStyle,
  visibilityZoneMatches,
  type HubElement,
  type LaunchAutomationPhase,
} from "@craftlauncher/shared";
import { isLaunchUiActive } from "@/lib/launch-session-ui";
import { launcherActions, useLauncherStore } from "@/lib/launcher-store";
import { getAdminApiUrl } from "@/lib/config";
import { useAuthStore } from "@/lib/auth-store";
import { HubElementView } from "./HubElementView";

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
  "instance-create-button",
  "show-on-click",
  "toggle-visible",
  "action-chip",
  "play-show-bind",
  "panel-visibility-select",
]);

const CONTAINER_SHELL_TYPES = new Set<HubElement["type"]>([
  "surface-box",
  "container",
  "visibility-zone",
]);

type HubRuntimeProps = {
  /** Pantalla fija (ventana Electron `#/hub-screen/{id}`); ignora `activeScreenId` del store. */
  screenId?: string | null;
};

export function HubRuntime({ screenId: forcedScreenId }: HubRuntimeProps = {}) {
  const layout = useLauncherStore((s) => s.layout);
  const launchPhase = useLauncherStore(
    (s) => s.launchSession.phase as LaunchAutomationPhase
  );
  const launchStatus = useLauncherStore((s) => s.status);
  const launchUiActive = isLaunchUiActive(launchPhase, launchStatus);
  const screen =
    (forcedScreenId
      ? layout.screens.find((s) => s.id === forcedScreenId)
      : undefined) ?? getActiveScreen(layout);
  const displayName = useAuthStore((s) => s.displayName ?? s.username ?? "Usuario");
  const username = useAuthStore((s) => s.username);
  const tier = useAuthStore((s) => s.tier);
  const sortedElements = useMemo(
    () =>
      bindAccountHubElements(
        [...screen.elements].sort((a, b) => a.zIndex - b.zIndex),
        { displayName, username, tier }
      ),
    [screen.elements, displayName, username, tier]
  );
  const viewport = resolveHubViewport(layout, screen, { elements: sortedElements });
  const borderlessFullscreen = Boolean(layout.window?.borderlessFullscreen);
  const fixedWindow =
    viewport.usesFixedWindow &&
    typeof layout.window?.width === "number" &&
    typeof layout.window?.height === "number";

  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [screenKey, setScreenKey] = useState(0);
  const contentHeight = Boolean(screen.scroll)
    ? Math.max(
        screen.height,
        ...sortedElements.map((el) => {
          const abs = elementAbsolutePosition(sortedElements, el.id);
          return abs.y + el.height + 48;
        })
      )
    : screen.height;

  useEffect(() => {
    setScreenKey((k) => k + 1);
  }, [screen.id]);

  useEffect(() => {
    if (fixedWindow && !borderlessFullscreen) {
      setScale(1);
      return;
    }

    const el = stageRef.current;
    if (!el) return;

    const update = () => {
      const w = el.clientWidth;
      if (screen.scroll) {
        setScale(borderlessFullscreen ? w / screen.width : Math.min(w / screen.width, 1));
        return;
      }
      const h = el.clientHeight;
      setScale(
        borderlessFullscreen
          ? Math.min(w / screen.width, h / screen.height)
          : Math.min(w / screen.width, h / screen.height, 1)
      );
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [borderlessFullscreen, fixedWindow, screen.width, screen.height, screen.scroll]);

  const scrollMode = Boolean(screen.scroll);
  const ui = layout.ui;
  const transition = ui?.screenTransition ?? "none";
  const transitionMs = Math.max(0, Math.min(2000, Number(ui?.transitionMs ?? 180)));
  const performanceMode = Boolean(ui?.performanceMode);

  const cssToStyle = (css: Record<string, string | number> | undefined): React.CSSProperties =>
    hubElementCssToStyle(css) as React.CSSProperties;

  const shouldRenderElement = (el: HubElement): boolean => {
    if (el.type === "automation-node" || el.type === "show-on-condition" || el.type === "hide-on-condition")
      return false;
    const isLaunchWidget =
      el.type === "launch-panel" ||
      (LAUNCH_UI_ELEMENT_TYPES.has(el.type) && el.type !== "launch-desktop-window-toggle");
    if (isLaunchWidget && (!el.visible || !launchUiActive)) return false;
    if (el.type === "visibility-zone") {
      const phaseKey = String(el.value ?? el.logic?.constants?.PHASE ?? "any");
      if (!visibilityZoneMatches(phaseKey, launchPhase)) return false;
    }
    return true;
  };

  const renderContainerShell = (el: HubElement, abs: { x: number; y: number }) => {
    const surfaceShellStyle =
      el.type === "surface-box" ? resolveSurfaceBoxShellStyle(el) : null;

    const shellRoot = hubVisualRootProps(el, {
      className: el.type === "surface-box" ? "ih-surface-box" : undefined,
      style: {
        position: "absolute",
        left: abs.x,
        top: abs.y,
        width: el.width,
        height: el.height,
        zIndex: el.zIndex,
        boxSizing: "border-box",
        pointerEvents: "none",
        ...(surfaceShellStyle ?? {
          borderRadius: el.style.borderRadius,
          backgroundColor: resolveHubBackgroundColor(el.style.backgroundColor, "transparent"),
          overflow: "hidden",
        }),
        ...cssToStyle(el.css),
      } as Record<string, string | number>,
    });

    return (
      <div
        key={el.id}
        className={shellRoot.className}
        style={shellRoot.style as React.CSSProperties}
        aria-hidden={el.type === "visibility-zone" ? true : undefined}
      />
    );
  };

  const cssSheet = useMemo(() => compileHubAdvancedCssSheet(sortedElements), [sortedElements]);

  const renderElement = (el: HubElement) => {
    if (!shouldRenderElement(el)) return null;

    const abs = elementAbsolutePosition(sortedElements, el.id);

    if (CONTAINER_SHELL_TYPES.has(el.type)) {
      return renderContainerShell(el, abs);
    }

    return (
      <HubElementView
        key={el.id}
        element={{ ...el, x: abs.x, y: abs.y }}
        allElements={sortedElements}
        onClick={CLICKABLE.has(el.type) ? () => void launcherActions.executeElementAction(el.id) : undefined}
        onChange={(value) => void launcherActions.handleRuntimeChange(el.id, value)}
      />
    );
  };

  return (
    <div
      ref={stageRef}
      className={`hub-stage${fixedWindow && !borderlessFullscreen ? " hub-stage-fixed" : ""}`}
      style={
        scrollMode
          ? {
              overflowY: "auto",
              overflowX: "hidden",
              alignItems: "flex-start",
              justifyContent: "flex-start",
              scrollBehavior: ui?.smoothScroll ? "smooth" : undefined,
            }
          : fixedWindow && !borderlessFullscreen
            ? { overflow: "hidden", alignItems: "flex-start", justifyContent: "flex-start" }
            : borderlessFullscreen
              ? { overflow: "hidden", alignItems: "center", justifyContent: "center" }
              : undefined
      }
    >
      <div
        key={transition === "none" ? screen.id : `${screen.id}:${screenKey}`}
        className={
          performanceMode
            ? `hub-screen hub-perf ${transition !== "none" ? `hub-transition-${transition}` : ""}`
            : `hub-screen ${transition !== "none" ? `hub-transition-${transition}` : ""}`
        }
        style={{
          width: screen.width,
          height: contentHeight,
          ...hubScreenContentBackgroundStyle(screen, "runtime", { proxyBaseUrl: getAdminApiUrl() }),
          ...(fixedWindow && !borderlessFullscreen
            ? { flexShrink: 0 }
            : scrollMode
              ? ({ zoom: scale } as React.CSSProperties)
              : ({ transform: `scale(${scale})` } as React.CSSProperties)),
          ...(transition !== "none"
            ? ({ ["--hub-transition-ms" as unknown as string]: `${transitionMs}ms` } as React.CSSProperties)
            : null),
        }}
      >
        {cssSheet ? <style dangerouslySetInnerHTML={{ __html: cssSheet }} /> : null}
        {sortedElements.map((el) => renderElement(el))}
      </div>
    </div>
  );
}
