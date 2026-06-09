"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { HubElement, HubLayout, HubScreen } from "@/types/hub-builder";
import { useHubBuilderStore } from "@/lib/hub-builder-store";
import {
  resolveGameMenuBindingPreview,
  type GameMenuBinding,
} from "@/lib/game-menu-bindings";
import { bindAccountHubElement } from "@craftlauncher/shared";

export type HubBuilderPreviewContextValue = {
  /** Ventana en la que estás editando (pestaña activa), no la superficie virtual de barra. */
  contextScreen: HubScreen;
  layout: HubLayout;
  previewMode: boolean;
  minecraftEditVersion: string;
  gameMenuUiScale: number;
};

const HubBuilderPreviewContext = createContext<HubBuilderPreviewContextValue | null>(null);

export function resolveBuilderContextScreen(layout: HubLayout): HubScreen {
  return layout.screens.find((s) => s.id === layout.activeScreenId) ?? layout.screens[0];
}

const MOD_TAB_LABELS = ["Mods", "Modpacks", "Texturas", "Destacados"] as const;

export function isPreviewNavTargetActive(element: HubElement, contextScreen: HubScreen): boolean {
  if (element.action !== "open-screen" || !element.targetScreenId) return false;
  return element.targetScreenId === contextScreen.id;
}

export function resolveModsTabActiveLabel(contextScreen: HubScreen): string | null {
  const name = contextScreen.name.trim().toLowerCase();
  const hit = MOD_TAB_LABELS.find((t) => t.toLowerCase() === name);
  if (hit) return hit;
  if (name.includes("modpack")) return "Modpacks";
  if (name.includes("textur")) return "Texturas";
  if (name.includes("destac")) return "Destacados";
  if (name.includes("mod")) return "Mods";
  return null;
}

export function resolveHubBuilderPreviewLabel(
  element: HubElement,
  ctx: HubBuilderPreviewContextValue
): string {
  const { contextScreen, layout, minecraftEditVersion } = ctx;
  const binding = element.style?.gameMenuBinding as GameMenuBinding | undefined;
  if (binding) {
    const resolved = resolveGameMenuBindingPreview(binding, minecraftEditVersion);
    if (resolved) return resolved;
  }
  const fallback = element.label?.trim() || element.type;

  if (element.type === "chrome-screen-title") {
    return contextScreen.name;
  }
  if (element.type === "chrome-status") {
    return "Sincronizado";
  }
  if (element.type === "chrome-launch-progress") {
    return "Ver log";
  }
  if (element.type === "chrome-brand") {
    return element.label?.trim() || "CraftLauncher";
  }
  if (element.type === "chrome-account") {
    return element.label?.trim() || "Usuario";
  }

  if (
    (element.type === "nav-item" || element.type === "button") &&
    element.action === "open-screen" &&
    element.targetScreenId
  ) {
    const target = layout.screens.find((s) => s.id === element.targetScreenId);
    if (!element.label?.trim() && target) return target.name;
  }

  const bound = bindAccountHubElement(element, {
    displayName: "Usuario demo",
    username: "usuario",
    tier: "free",
  });
  if (bound.label !== element.label) return bound.label;

  return fallback;
}

export function HubBuilderPreviewProvider({ children }: { children: ReactNode }) {
  const layout = useHubBuilderStore((s) => s.layout);
  const editTarget = useHubBuilderStore((s) => s.editTarget);
  const previewMode = useHubBuilderStore((s) => s.previewMode);
  const minecraftEditVersion = useHubBuilderStore((s) => s.minecraftEditVersion);
  const gameMenuUiScale = useHubBuilderStore((s) => s.gameMenuUiScale);
  const activeScreenId = layout.activeScreenId;

  const value = useMemo(
    (): HubBuilderPreviewContextValue => ({
      contextScreen: resolveBuilderContextScreen(layout),
      layout,
      previewMode,
      minecraftEditVersion,
      gameMenuUiScale,
    }),
    [layout, editTarget, activeScreenId, previewMode, minecraftEditVersion, gameMenuUiScale]
  );

  return (
    <HubBuilderPreviewContext.Provider value={value}>{children}</HubBuilderPreviewContext.Provider>
  );
}

export function useHubBuilderPreviewContext(): HubBuilderPreviewContextValue {
  const ctx = useContext(HubBuilderPreviewContext);
  const layout = useHubBuilderStore((s) => s.layout);
  const previewMode = useHubBuilderStore((s) => s.previewMode);
  const minecraftEditVersion = useHubBuilderStore((s) => s.minecraftEditVersion);
  const gameMenuUiScale = useHubBuilderStore((s) => s.gameMenuUiScale);
  if (ctx) return ctx;
  return {
    contextScreen: resolveBuilderContextScreen(layout),
    layout,
    previewMode,
    minecraftEditVersion,
    gameMenuUiScale,
  };
}
