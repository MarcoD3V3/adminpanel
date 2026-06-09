"use client";

import { useMemo } from "react";
import { resolveBuilderContextScreen } from "@/components/hub-builder/hub-builder-preview-context";
import { useHubBuilderStore } from "@/lib/hub-builder-store";
import {
  findHubElementById,
  isScreenChromeVirtualId,
  launcherChromeAsScreen,
  resolveHubViewport,
  resolveLayoutChromeHeight,
  resolveLauncherChromeWidth,
  type HubViewport,
} from "@craftlauncher/shared";
import type { HubElement, HubLayout, HubScreen } from "@/types/hub-builder";

export type HubBuilderViewport = HubViewport;

/** Misma geometría que el launcher: chrome de la ventana + área de contenido. */
export function resolveHubBuilderViewport(
  layout: HubLayout,
  screen: HubScreen,
  options?: {
    previewMode?: boolean;
    elements?: HubElement[];
    previewFrameSize?: { width: number; height: number } | null;
  }
): HubBuilderViewport {
  if (isScreenChromeVirtualId(screen.id)) {
    const barW = resolveLauncherChromeWidth(layout);
    const barH = screen.height;
    return {
      frameWidth: barW,
      frameHeight: barH,
      contentWidth: barW,
      contentHeight: barH,
      canvasWidth: barW,
      canvasHeight: barH,
      chromeHeight: 0,
      usesFixedWindow: true,
    };
  }

  const ownerId = layout.activeScreenId;
  const chromeHeight = screen.independentCanvas ? 0 : resolveLayoutChromeHeight(layout, ownerId);
  const base = resolveHubViewport(layout, screen, {
    elements: options?.elements,
    contentChromeHeight: chromeHeight,
  });

  const override = options?.previewFrameSize ?? null;
  if (!override) return base;

  if (screen.independentCanvas) {
    return {
      ...base,
      frameWidth: override.width,
      frameHeight: override.height,
      contentWidth: override.width,
      contentHeight: override.height,
      canvasWidth: override.width,
      canvasHeight: override.height,
      chromeHeight: 0,
      usesFixedWindow: true,
    };
  }

  if (!options?.previewMode) return base;

  const ch = chromeHeight;
  const contentH = Math.max(80, override.height - ch);
  return {
    frameWidth: override.width,
    frameHeight: override.height,
    contentWidth: override.width,
    contentHeight: contentH,
    canvasWidth: override.width,
    canvasHeight: contentH,
    chromeHeight: ch,
    usesFixedWindow: true,
  };
}

function resolveActiveScreen(
  editTarget: "screen" | "launcher-chrome",
  layout: HubLayout
): HubScreen {
  if (editTarget === "launcher-chrome") {
    return launcherChromeAsScreen(layout, layout.activeScreenId);
  }
  return layout.screens.find((sc) => sc.id === layout.activeScreenId) ?? layout.screens[0];
}

export function useActiveScreen(): HubScreen {
  const editTarget = useHubBuilderStore((s) => s.editTarget);
  const layout = useHubBuilderStore((s) => s.layout);

  return useMemo(
    () => resolveActiveScreen(editTarget, layout),
    [editTarget, layout]
  );
}

/** Pantalla de contenido activa (Inicio, Mods, etc.), sin la superficie virtual de barra. */
export function useContentScreen(): HubScreen {
  const layout = useHubBuilderStore((s) => s.layout);
  return useMemo(() => resolveBuilderContextScreen(layout), [layout]);
}

function findElementInLayout(layout: HubLayout, selectedId: string): HubElement | null {
  return (
    findHubElementById(layout, selectedId, layout.activeScreenId) ??
    findHubElementById(layout, selectedId) ??
    null
  );
}

function isElementOnScreenChrome(layout: HubLayout, selectedId: string): boolean {
  for (const screen of layout.screens) {
    if (screen.chrome?.elements?.some((e) => e.id === selectedId)) return true;
  }
  return Boolean(layout.launcherChrome?.elements?.some((e) => e.id === selectedId));
}

export function useSelectedElement(): HubElement | null {
  const layout = useHubBuilderStore((s) => s.layout);
  const selectedId = useHubBuilderStore((s) => s.selectedId);

  return useMemo(() => {
    if (!selectedId) return null;
    return findElementInLayout(layout, selectedId);
  }, [layout, selectedId]);
}

export function useSelectedElementOnChrome(): boolean {
  const layout = useHubBuilderStore((s) => s.layout);
  const selectedId = useHubBuilderStore((s) => s.selectedId);
  return Boolean(selectedId && isElementOnScreenChrome(layout, selectedId));
}

export const TEXT_COLOR_TYPES = new Set([
  "text",
  "button",
  "play-button",
  "nav-item",
  "banner",
  "news-card",
  "modpack-slot",
  "version-selector",
  "profile-widget",
  "icon-button",
  "instance-create-button",
  "link",
  "chip",
  "stat-card",
  "script-button",
  "input-field",
  "checkbox",
  "dropdown",
  "api-call",
  "timer",
  "counter",
  "toast-trigger",
]);

export {
  DEFAULT_HUB_PLAY_BG as DEFAULT_PLAY_BG,
  DEFAULT_HUB_SURFACE_BG as DEFAULT_SURFACE_BG,
  DEFAULT_HUB_TEXT_COLOR as DEFAULT_TEXT_COLOR,
  normalizeHexColor,
  resolveHubBackgroundColor as resolveBackgroundColor,
  resolveHubTextColor as resolveTextColor,
} from "@craftlauncher/shared";
