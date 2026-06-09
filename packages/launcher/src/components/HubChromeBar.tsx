"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  backgroundExtendsIntoChrome,
  bindAccountHubElements,
  ensureScreenChrome,
  getActiveScreen,
  hasScreenChromeContent,
  hubChromeBarSurfaceStyle,
  isNativeChromeElementType,
  resolveBackgroundChromeStyle,
  screenChromeVirtualId,
  resolveHubBackgroundColor,
  resolveHubTextColor,
  scaleChromeElementLayout,
} from "@craftlauncher/shared";
import { HubElementView } from "@/components/HubElementView";
import { launcherActions, useLauncherStore } from "@/lib/launcher-store";
import { useAuthStore } from "@/lib/auth-store";
import { useLauncherDataStore } from "@/lib/launcher-data-store";
import { getLauncherApi, isDesktopLauncher } from "@/lib/electron-api";
import { isLaunchInProgress } from "@/lib/launch-session-ui";
import { LaunchProgressChip } from "./LaunchProgressPanel";
import { HubElementIcon } from "./HubElementIcon";
import type { HubElement, HubLayout } from "@craftlauncher/shared";

const CHROME_CLICKABLE = new Set([
  "chrome-button",
  "chrome-icon-button",
  "chrome-account",
  "chrome-launch-progress",
]);

function ChromeWidgetNode({
  element,
  layoutScaleX,
  onChange,
  onClick,
}: {
  element: HubElement;
  layoutScaleX: number;
  onChange?: (value: string | number | boolean) => void;
  onClick?: () => void;
}) {
  const box = scaleChromeElementLayout(element, layoutScaleX);
  return (
    <div
      className="chrome-el chrome-el-widget"
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.width,
        height: box.height,
        zIndex: element.zIndex,
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <HubElementView element={element} fillParent onChange={onChange} onClick={onClick} />
    </div>
  );
}

function ChromeElementNode({
  element,
  chromeScreen,
  layoutScaleX,
  statusHint,
  syncError,
  accountLabel,
  onAction,
  onChange,
}: {
  element: HubElement;
  chromeScreen: ReturnType<typeof getActiveScreen>;
  layout: HubLayout;
  layoutScaleX: number;
  statusHint: string | null;
  syncError: string | null;
  accountLabel: string | null;
  onAction: (el: HubElement) => void;
  onChange?: (value: string | number | boolean) => void;
}) {
  if (!element.visible) return null;

  if (!isNativeChromeElementType(element.type)) {
    return (
      <ChromeWidgetNode
        element={element}
        layoutScaleX={layoutScaleX}
        onChange={onChange}
        onClick={() => onAction(element)}
      />
    );
  }

  const screen = chromeScreen;
  const box = scaleChromeElementLayout(element, layoutScaleX);
  const style: React.CSSProperties = {
    position: "absolute",
    left: box.x,
    top: box.y,
    width: box.width,
    height: box.height,
    zIndex: element.zIndex,
    borderRadius: element.style.borderRadius ?? 0,
    fontSize: element.style.fontSize ?? 12,
    fontWeight: element.style.fontWeight ?? "normal",
    color: resolveHubTextColor(element.style.textColor),
    background: resolveHubBackgroundColor(element.style.backgroundColor, "transparent"),
    ...(element.css as React.CSSProperties),
  };

  const click = CHROME_CLICKABLE.has(element.type)
    ? {
        type: "button" as const,
        onClick: () => onAction(element),
      }
    : {};

  switch (element.type) {
    case "chrome-brand":
      return (
        <span className="chrome-el chrome-el-brand" style={style}>
          {element.label}
        </span>
      );
    case "chrome-screen-title":
      return (
        <span className="chrome-el chrome-el-screen" style={style} title={screen.name}>
          {screen.name}
        </span>
      );
    case "chrome-status":
      return (
        <span
          className={`chrome-el chrome-el-status${syncError ? " error" : ""}`}
          style={style}
          title={statusHint ?? undefined}
        >
          {statusHint ?? element.label ?? ""}
        </span>
      );
    case "chrome-account":
      return (
        <button type="button" className="chrome-el chrome-el-account" style={style} {...click}>
          <span className="chrome-el-account-icon" aria-hidden>
            ◉
          </span>
          <span className="truncate">{accountLabel ?? element.label}</span>
        </button>
      );
    case "chrome-launch-progress":
      return (
        <div className="chrome-el chrome-el-launch" style={{ ...style, background: "transparent" }}>
          <LaunchProgressChip />
        </div>
      );
    case "chrome-spacer":
      return <span className="chrome-el chrome-el-spacer" style={style} aria-hidden />;
    case "chrome-divider":
      return <span className="chrome-el chrome-el-divider" style={style} aria-hidden />;
    case "chrome-icon-button":
      return (
        <button
          type="button"
          className="chrome-el chrome-el-btn chrome-el-icon-btn"
          style={style}
          title={element.label || undefined}
          aria-label={element.label || undefined}
          {...click}
        >
          <HubElementIcon
            element={element}
            size={Math.max(12, Math.min(16, Math.round(Math.min(element.width, element.height) * 0.5)))}
            strokeWidth={2}
          />
        </button>
      );
    case "chrome-button":
      return (
        <button type="button" className="chrome-el chrome-el-btn" style={style} {...click}>
          {element.label}
        </button>
      );
    default:
      return null;
  }
}

type HubChromeBarProps = {
  /** Título de pantalla en la barra (ventanas `#/hub-screen/{id}`). */
  screenId?: string | null;
};

export function HubChromeBar({ screenId }: HubChromeBarProps = {}) {
  const layout = useLauncherStore((s) => s.layout);
  const chromeScreen = useMemo(() => {
    if (screenId) {
      return layout.screens.find((s) => s.id === screenId) ?? getActiveScreen(layout);
    }
    return getActiveScreen(layout);
  }, [layout, screenId]);
  const loading = useLauncherStore((s) => s.loading);
  const syncError = useLauncherStore((s) => s.syncError);
  const lastSync = useLauncherStore((s) => s.lastSync);
  const status = useLauncherStore((s) => s.status);
  const launchProgress = useLauncherStore((s) => s.launchProgress);
  const launchSession = useLauncherStore((s) => s.launchSession);
  const username = useAuthStore((s) => s.username);
  const displayName = useAuthStore((s) => s.displayName);
  const tier = useAuthStore((s) => s.tier);
  const accountLabel = username ?? displayName;
  const api = getLauncherApi();
  const desktop = isDesktopLauncher();
  const hasChrome = hasScreenChromeContent(chromeScreen);
  const chrome = useMemo(
    () => (hasChrome ? ensureScreenChrome(chromeScreen, layout) : null),
    [hasChrome, chromeScreen, layout]
  );
  const designWidth = chrome?.width ?? 0;
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageWidth, setStageWidth] = useState(designWidth);

  useLayoutEffect(() => {
    if (!hasChrome) return;
    const node = stageRef.current;
    if (!node || designWidth <= 0) return;

    const update = () => {
      const w = node.clientWidth;
      if (w > 0) setStageWidth(w);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [designWidth, hasChrome]);

  const layoutScaleX = designWidth > 0 ? stageWidth / designWidth : 1;

  const chromeStageStyle = useMemo(() => {
    const extendsBg = backgroundExtendsIntoChrome(resolveBackgroundChromeStyle(chromeScreen));
    if (!extendsBg) {
      return { background: chrome?.backgroundColor ?? "#0a0b0d" };
    }
    return {
      background: "transparent",
      ...hubChromeBarSurfaceStyle(chromeScreen),
    };
  }, [chrome, chromeScreen]);

  const statusHint = useMemo(() => {
    const launchHidden =
      !launchSession.visible &&
      launchSession.phase !== "idle" &&
      isLaunchInProgress(launchSession.phase);

    if (launchHidden) return launchProgress ?? "Descarga en segundo plano…";
    if (status === "launching" || status === "running") {
      return launchProgress ?? "Lanzando Minecraft…";
    }
    if (syncError) return syncError;
    if (lastSync) {
      return `Sync ${new Date(lastSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    if (loading) return "Conectando…";
    return null;
  }, [launchSession, launchProgress, status, syncError, lastSync, loading]);

  const sorted = useMemo(() => {
    if (!chrome) return [];
    return bindAccountHubElements([...chrome.elements].sort((a, b) => a.zIndex - b.zIndex), {
      displayName: displayName ?? username ?? "Usuario",
      username,
      tier,
    });
  }, [chrome, displayName, username, tier]);

  if (!hasChrome || !chrome) {
    return null;
  }

  const runChromeAction = async (el: HubElement) => {
    if (el.action === "sync-layout") {
      void launcherActions.syncLayout();
      return;
    }
    if (el.action === "minimize-window") {
      void api?.minimize();
      return;
    }
    if (el.action === "close-window") {
      void api?.close();
      return;
    }
    if (el.action === "open-launch-log") {
      launcherActions.showLaunchPanel();
      return;
    }
    await launcherActions.executeElementAction(el.id);
  };

  const chromeExtendsBg = backgroundExtendsIntoChrome(resolveBackgroundChromeStyle(chromeScreen));

  return (
    <header
      className="chrome chrome-top hub-chrome-custom"
      style={{
        height: chrome.height,
        ...(chromeExtendsBg ? { background: "transparent" } : undefined),
      }}
      data-hub-surface={screenChromeVirtualId(chromeScreen.id)}
    >
      <div
        ref={stageRef}
        className="chrome-drag hub-chrome-stage"
        style={{
          position: "relative",
          width: "100%",
          height: chrome.height,
          ...chromeStageStyle,
        }}
      >
        {sorted.map((el) => (
          <ChromeElementNode
            key={el.id}
            element={el}
            chromeScreen={chromeScreen}
            layout={layout}
            layoutScaleX={layoutScaleX}
            statusHint={statusHint}
            syncError={syncError}
            accountLabel={accountLabel ?? null}
            onAction={(e) => void runChromeAction(e)}
            onChange={(value) => void launcherActions.handleRuntimeChange(el.id, value)}
          />
        ))}
      </div>
      {!desktop && (
        <div className="chrome-end hub-chrome-fallback-actions" aria-hidden>
          <span className="text-[10px] text-[var(--muted)]">Solo escritorio</span>
        </div>
      )}
    </header>
  );
}
