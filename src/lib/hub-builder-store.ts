"use client";

import { create } from "zustand";
import type { HubElementSurface } from "@/lib/hub-builder-elements-index";
import type { HubElementClipboard } from "@/lib/hub-builder-clipboard";
import type { ContextMenuState, HubElement, HubLayout, HubScreen, ScriptLogEntry } from "@/types/hub-builder";

export type CanvasFocusRequest = {
  token: number;
  elementId: string;
  screenId: string;
  surface: HubElementSurface;
};

export type ElementFocusFlash = {
  elementId: string;
  token: number;
};

let focusFlashClearTimer: ReturnType<typeof setTimeout> | null = null;
import {
  defaultHubLayout,
  defaultElementLogic,
  defaultElementStyle,
  elementPalette,
  clampFocusHubZoom,
  clampHubZoom,
  GRID_SIZE,
  snapToGrid,
  snapCenterAxis,
  clampElement,
} from "@/lib/hub-builder-data";
import { findElementByRef } from "@/lib/hub-logic-utils";
import {
  applyVisibilityTargetList,
  collectAllRefIds,
  collectLaunchHudElements,
  createLaunchPanelBundle,
  hasVisibilityActions,
  isVisibilityRuleElement,
  parseVisibilityActions,
  suggestUniqueRefId,
  normalizeLaunchLayout,
  normalizePositionClass,
  findHubElementById,
  applySharedPropsToElement,
  listPositionClassPeers,
  pickPositionClassLeader,
  sharedPropsFromElement,
  patchChromeElementsById,
  patchChromeElementsByRole,
  resolveElementScreenId,
  resolvePositionClassSurface,
  syncLayoutByPositionClass,
} from "@craftlauncher/shared";
import {
  fetchHubLayoutDraftFromApi,
  fetchHubLayoutFromApi,
  layoutFingerprint,
  pickNewestHubLayout,
  publishHubLayoutToApi,
  readHubLayoutFromStorage,
  saveHubLayoutDraftToApi,
  writeHubLayoutToStorage,
} from "@/lib/hub-builder-persistence";
import {
  actionFallbackLabel,
  clearPreviewIntervals,
  registerPreviewInterval,
  resolveActionTargetScreen,
} from "@/lib/hub-preview-runtime";
// (sin defaults inyectados)

// Nota: antes existía una "migración" que inyectaba defaults al cargar/publicar.
// El usuario pidió que NO se agregue nada por defecto: el layout debe mantenerse tal cual.

import {
  coerceLayoutWindowConsistency,
  emptyScreenChromeLayout,
  fixedWindowContentSize,
  fitScreenElementsToBounds,
  resolveLayoutChromeHeight,
  isScreenChromeVirtualId,
  LAUNCHER_CHROME_SCREEN_ID,
  launcherChromeAsScreen,
  normalizePerScreenChromeLayout,
  parseScreenChromeVirtualId,
  patchScreenChromeMeta,
  patchScreenOrChromeElements,
  resolveLauncherChromeWidth,
  screenChromeVirtualId,
  syncLauncherChromeWithWindow,
  pickForgeVersionFromLayout,
  resolveForgeVersion,
  ensureAccountProfileScreen,
  clearScreenNavHistory,
  popScreenNavHistory,
  pushScreenNavHistory,
  defaultIconForPalette,
  HUB_UI_CONSTANT_KEYS,
} from "@craftlauncher/shared";
import { resolveEditorSnapGridSize } from "@/lib/hub-editor-canvas-settings";
import { resetHubScriptRuntime, runHubScript, type ScriptRunResult } from "@/lib/hub-script-runner";
import {
  DEFAULT_HUB_EDITOR_CANVAS_SETTINGS,
  patchHubEditorCanvasSettings,
  readHubEditorCanvasSettings,
  writeHubEditorCanvasSettings,
  type HubEditorCanvasSettings,
} from "@/lib/hub-editor-canvas-settings";
import {
  createElementClipboard,
  collectSubtreeIds,
  instantiateClipboardSubtree,
  normalizeElementClipboard,
} from "@/lib/hub-builder-clipboard";
import {
  elementAbsolutePosition,
  elementEditorBounds,
  elementParentInset,
  repairInvalidElementParents,
  repairLayoutElementParents,
  resolveNewElementPlacement,
  resolvePastePlacement,
  type AddPlacementMode,
} from "@/lib/hub-builder-placement";
import { resolveVersionProfile } from "@/lib/minecraft-versions";
import {
  GAME_MENU_SCREEN_ID,
  GAME_MENU_W,
  GAME_MENU_H,
  DEFAULT_MINECRAFT_WINDOW,
  detectPrimaryDisplaySize,
  exportGameUi,
  defaultGameMenuElements,
  repairGameMenuScreen,
} from "@/lib/game-ui-export";
import { gameMenuPalette } from "@/lib/game-menu-palette";
import {
  GAME_LOADING_SCREEN_ID,
  GAME_LOADING_W,
  GAME_LOADING_H,
  exportLoadingUi,
  defaultLoadingScreenElements,
  repairLoadingScreen,
} from "@/lib/loading-ui-export";
import { loadingPalette } from "@/lib/loading-menu-palette";

const MINECRAFT_EDITOR_SCREEN_IDS = new Set([GAME_MENU_SCREEN_ID, GAME_LOADING_SCREEN_ID]);

/** Quita pantallas de edición Minecraft de una copia para publicar al launcher. */
function stripMinecraftEditorScreens(layout: HubLayout): HubLayout {
  const screens = layout.screens.filter((s) => !MINECRAFT_EDITOR_SCREEN_IDS.has(s.id));
  if (screens.length === 0 || screens.length === layout.screens.length) return layout;
  const activeScreenId = MINECRAFT_EDITOR_SCREEN_IDS.has(layout.activeScreenId)
    ? screens[0]!.id
    : layout.activeScreenId;
  return { ...layout, screens, activeScreenId };
}

export interface PreviewToast {
  id: string;
  message: string;
  type: string;
}

let savedShowGrid: boolean | null = null;
let previewLayoutSnapshot: HubLayout | null = null;

function findLayoutElement(layout: HubLayout, elementId: string): HubElement | null {
  for (const screen of layout.screens) {
    const chromeHit = screen.chrome?.elements?.find((e) => e.id === elementId);
    if (chromeHit) return chromeHit;
    const hit = screen.elements.find((e) => e.id === elementId);
    if (hit) return hit;
  }
  return layout.launcherChrome?.elements?.find((e) => e.id === elementId) ?? null;
}

function resolveElementSurfaceId(
  layout: HubLayout,
  elementId: string,
  preferredScreenId?: string
): string | null {
  const ownerScreenId = resolveElementScreenId(layout, elementId, preferredScreenId);
  if (!ownerScreenId) return null;

  const screen = layout.screens.find((s) => s.id === ownerScreenId);
  if (screen?.chrome?.elements?.some((e) => e.id === elementId)) {
    return screenChromeVirtualId(ownerScreenId);
  }
  return ownerScreenId;
}

function resolveChromeSurfaceScreen(layout: HubLayout, surfaceId: string) {
  const ownerId = parseScreenChromeVirtualId(surfaceId);
  if (ownerId) {
    return layout.screens.find((s) => s.id === ownerId) ?? null;
  }
  if (surfaceId === LAUNCHER_CHROME_SCREEN_ID) {
    return layout.screens.find((s) => s.id === layout.activeScreenId) ?? layout.screens[0] ?? null;
  }
  return null;
}

function paletteTargetsChrome(palette: { category: string; chromeTarget?: boolean }): boolean {
  return palette.category === "chrome" || Boolean(palette.chromeTarget);
}

type ResolvedPalette = {
  id: string;
  type: HubElement["type"];
  defaultWidth: number;
  defaultHeight: number;
  defaultLabel: string;
  defaultAction: HubElement["action"];
  category: string;
  chromeTarget?: boolean;
  defaultExternalUrl?: string;
  defaultServerAddress?: string;
  defaultStyle?: Partial<HubElement["style"]>;
  preset?: Partial<HubElement>;
};

function resolvePaletteItem(
  layout: HubLayout,
  paletteIdOrType: string
): ResolvedPalette | null {
  const isGameMenu = layout.activeScreenId === GAME_MENU_SCREEN_ID;
  const isLoadingScreen = layout.activeScreenId === GAME_LOADING_SCREEN_ID;
  if (isLoadingScreen) {
    const lm =
      loadingPalette.find((p) => p.id === paletteIdOrType) ??
      loadingPalette.find((p) => p.type === paletteIdOrType);
    if (lm) return lm;
    return null;
  }
  if (isGameMenu) {
    const gm =
      gameMenuPalette.find((p) => p.id === paletteIdOrType) ??
      gameMenuPalette.find((p) => p.type === paletteIdOrType);
    if (gm) return gm;
    return null;
  }
  const palette =
    elementPalette.find((p) => p.id === paletteIdOrType) ??
    elementPalette.find((p) => p.type === paletteIdOrType);
  return palette ?? null;
}

function loadingElementStyle(type: HubElement["type"]): HubElement["style"] {
  if (type === "text") {
    return { textColor: "#c8cad0", fontSize: 10, borderRadius: 0 };
  }
  if (type === "launch-progress-bar") {
    return { backgroundColor: "#1a1d22", textColor: "#6b9e78", borderRadius: 0 };
  }
  return defaultElementStyle(type);
}

function gameMenuElementStyle(type: HubElement["type"]): HubElement["style"] {
  const base = defaultElementStyle(type);
  if (
    type === "text" ||
    type === "launch-hint-text" ||
    type === "launch-phase-label" ||
    type === "launch-detail-text"
  ) {
    return { ...base, textColor: "#8b919a", fontSize: 8, borderRadius: 0 };
  }
  if (type === "play-button") {
    return { ...base, backgroundColor: "#496f4f", textColor: "#ffffff", borderRadius: 0, fontSize: 9 };
  }
  if (type === "nav-item" || type === "icon-button") {
    return { ...base, backgroundColor: "#2b2e33", textColor: "#e8eaed", borderRadius: 0, fontSize: 8 };
  }
  if (type === "surface-box" || type === "news-card" || type === "stat-card" || type === "profile-widget") {
    return { ...base, backgroundColor: "#16181c", textColor: "#e8eaed", borderRadius: 12, fontSize: 8 };
  }
  if (type === "banner") {
    return { ...base, backgroundColor: "#5b2d8a", textColor: "#ffffff", borderRadius: 10, fontSize: 8 };
  }
  if (type === "chip" || type === "minecraft-status-chip" || type === "action-chip") {
    return { ...base, backgroundColor: "#252830", textColor: "#f0c040", borderRadius: 999, fontSize: 7 };
  }
  if (type === "divider") {
    return { ...base, backgroundColor: "#2b2f36", borderRadius: 0 };
  }
  return {
    ...base,
    backgroundColor: "#2b2e33",
    textColor: "#e8eaed",
    borderRadius: 0,
    fontSize: 8,
  };
}

function buildElement(
  paletteIdOrType: string,
  x: number,
  y: number,
  zIndex: number,
  existingRefs: string[] = [],
  grid = GRID_SIZE,
  layout?: HubLayout
): HubElement | null {
  const palette = layout
    ? resolvePaletteItem(layout, paletteIdOrType)
    : elementPalette.find((p) => p.id === paletteIdOrType) ??
      elementPalette.find((p) => p.type === paletteIdOrType);
  if (!palette) return null;

  const type = palette.type;
  const isGameMenu = layout?.activeScreenId === GAME_MENU_SCREEN_ID;
  const isLoadingScreen = layout?.activeScreenId === GAME_LOADING_SCREEN_ID;
  const logic = defaultElementLogic(type);
  const uniqueRefId = suggestUniqueRefId(type, existingRefs);
  if (logic) {
    logic.refId = uniqueRefId;
  }
  const iconName =
    type === "icon-button" || type === "chrome-icon-button" || type === "toast-trigger"
      ? defaultIconForPalette(palette.id, palette.defaultAction)
      : undefined;
  const baseStyle = isGameMenu
    ? gameMenuElementStyle(type)
    : isLoadingScreen
      ? loadingElementStyle(type)
      : defaultElementStyle(type);
  const base: HubElement = {
    id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    x: snapToGrid(x, grid),
    y: snapToGrid(y, grid),
    width: palette.defaultWidth,
    height: palette.defaultHeight,
    zIndex,
    label: palette.defaultLabel,
    action: palette.defaultAction,
    ...(palette.defaultExternalUrl ? { externalUrl: palette.defaultExternalUrl } : {}),
    ...(palette.defaultServerAddress ? { serverAddress: palette.defaultServerAddress } : {}),
    visible: true,
    locked: false,
    style: { ...baseStyle, ...palette.defaultStyle },
    logic:
      iconName != null
        ? {
            enabled: logic?.enabled ?? false,
            trigger: logic?.trigger ?? "click",
            script: logic?.script ?? "",
            ...logic,
            constants: {
              ...(logic?.constants ?? {}),
              [HUB_UI_CONSTANT_KEYS.ICON_NAME]: iconName,
            },
          }
        : logic,
    value: type === "toggle" || type === "checkbox" ? false : type === "counter" ? 0 : type === "slider" ? 50 : undefined,
    ...(type === "container"
      ? {
          container: {
            display: "absolute",
            position: "absolute",
            direction: "row",
            wrap: true,
            align: "center",
            justify: "start",
            gap: 8,
            padding: 10,
          },
        }
      : type === "surface-box"
        ? {
            container: {
              display: "flex",
              direction: "column",
              wrap: false,
              align: "start",
              justify: "start",
              gap: 8,
              padding: 12,
            },
            surface: {
              preset: "glass",
              backdropBlur: 14,
              backgroundOpacity: 38,
              borderWidth: 0,
              borderStyle: "none",
            },
          }
        : null),
    css: {},
  };

  if (palette.preset) {
    const preset = JSON.parse(JSON.stringify(palette.preset)) as Partial<HubElement>;
    // Mantener id / coords / zIndex del elemento creado.
    delete (preset as Partial<HubElement>).id;
    delete (preset as Partial<HubElement>).x;
    delete (preset as Partial<HubElement>).y;
    delete (preset as Partial<HubElement>).zIndex;
    const merged: HubElement = {
      ...base,
      ...preset,
      style: { ...base.style, ...(preset.style ?? {}) },
      logic: preset.logic ? { ...base.logic, ...preset.logic, refId: uniqueRefId } : base.logic,
    };
    if (merged.logic && uniqueRefId) merged.logic.refId = uniqueRefId;
    return merged;
  }

  return base;
}

export type HubEditTarget = "screen" | "launcher-chrome";

interface HubBuilderState {
  layout: HubLayout;
  editTarget: HubEditTarget;
  selectedId: string | null;
  selectedIds: string[];
  showGrid: boolean;
  zoom: number;
  autoFit: boolean;
  previewMode: boolean;
  /** Tamaño de ventana simulado en modo probar (null = usar layout). */
  previewFrameSize: { width: number; height: number } | null;
  /** Escala visual de fuentes/bordes del menú Minecraft en el canvas. */
  gameMenuUiScale: number;
  previewToasts: PreviewToast[];
  history: HubLayout[];
  historyIndex: number;
  selectElement: (id: string | null) => void;
  selectElements: (ids: string[], primaryId?: string | null) => void;
  canvasFocusRequest: CanvasFocusRequest | null;
  elementFocusFlash: ElementFocusFlash | null;
  elementTreeBubble: { x: number; y: number } | null;
  openElementTreeBubble: (x: number, y: number) => void;
  closeElementTreeBubble: () => void;
  navigateToElement: (args: {
    elementId: string;
    screenId: string;
    surface: HubElementSurface;
  }) => void;
  setShowGrid: (show: boolean) => void;
  setZoom: (zoom: number) => void;
  setFocusZoom: (zoom: number) => void;
  setZoomFit: (zoom: number) => void;
  setAutoFit: (autoFit: boolean) => void;
  setPreviewMode: (preview: boolean) => void;
  setPreviewFrameSize: (size: { width: number; height: number } | null) => void;
  setGameMenuUiScale: (scale: number) => void;
  setEditTarget: (target: HubEditTarget) => void;
  getActiveScreen: () => HubScreen;
  setActiveScreen: (screenId: string, options?: { recordHistory?: boolean }) => void;
  goBackScreen: () => void;
  addScreen: (name?: string) => void;
  removeScreen: (screenId: string) => void;
  duplicateScreen: (screenId: string) => void;
  executeElementAction: (elementId: string) => Promise<void>;
  handleRuntimeChange: (elementId: string, value: string | number | boolean) => Promise<void>;
  pushPreviewToast: (message: string, type?: string) => void;
  dismissPreviewToast: (id: string) => void;
  /** Abre (o crea) la pantalla del menú de Minecraft para editarla con el Hub. */
  openGameMenuScreen: () => void;
  /** Abre (o crea) la pantalla de carga de Minecraft para editarla con el Hub. */
  openLoadingScreen: () => void;
  updateLayout: (patch: Partial<HubLayout>) => void;
  /** Tamaño ventana fija — actualiza canvas al instante (sin historial undo). */
  setLauncherWindowSize: (patch: {
    width?: number;
    height?: number;
    lockSize?: boolean;
    borderlessFullscreen?: boolean;
  }) => void;
  runPreviewScreenSetup: () => void;
  updateScreen: (screenId: string, patch: Partial<HubScreen>) => void;
  updateElement: (id: string, patch: Partial<HubElement>) => void;
  /** Copia la posición/tamaño del elemento a todos los de su clase en la misma superficie. */
  syncPositionClassFromElement: (id: string) => number;
  moveElement: (id: string, x: number, y: number, options?: { snap?: boolean }) => void;
  resizeElement: (id: string, patch: { x: number; y: number; width: number; height: number }) => void;
  addElement: (paletteIdOrType: string) => void;
  addElementAt: (
    paletteIdOrType: string,
    x: number,
    y: number,
    options?: { mode?: AddPlacementMode }
  ) => void;
  removeElement: (id: string) => void;
  removeElements: (ids: string[]) => void;
  duplicateElement: (id: string) => void;
  reorderElement: (id: string, direction: "up" | "down") => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  nudgeElement: (id: string, dx: number, dy: number) => void;
  alignElement: (id: string, align: "left" | "center-h" | "right" | "top" | "center-v" | "bottom") => void;
  toggleLock: (id: string) => void;
  toggleVisible: (id: string) => void;
  copyElement: (id: string) => void;
  pasteElement: (atX?: number, atY?: number, insideParentId?: string) => void;
  selectNextElement: (direction: 1 | -1) => void;
  clipboard: HubElementClipboard | null;
  editSessionActive: boolean;
  /** Solo `editor` puede modificar; `viewer` = otro admin editando. */
  hubEditAccess: "pending" | "editor" | "viewer";
  hubLockHolder: string | null;
  setHubEditAccess: (access: "pending" | "editor" | "viewer", holder?: string | null) => void;
  applyRemoteLayout: (layout: HubLayout) => void;
  syncRemoteDraft: () => Promise<boolean>;
  contextMenu: ContextMenuState | null;
  scriptConsole: ScriptLogEntry[];
  openContextMenu: (menu: ContextMenuState) => void;
  closeContextMenu: () => void;
  runElementLogic: (id: string) => Promise<void>;
  clearScriptConsole: () => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  resetLayout: () => void;
  saveLayout: () => boolean;
  loadSavedLayout: () => Promise<boolean>;
  publishLayout: () => Promise<boolean>;
  storageHydrated: boolean;
  /** Último layout guardado en localStorage (huella). */
  savedFingerprint: string | null;
  /** Último layout publicado en el servidor (huella). */
  publishedFingerprint: string | null;
  editorCanvasSettings: HubEditorCanvasSettings;
  updateEditorCanvasSettings: (patch: Partial<HubEditorCanvasSettings> | HubEditorCanvasSettings) => void;
  /** Versión MC activa al editar menú / pantalla de carga (desde admin). */
  minecraftEditVersion: string;
  setMinecraftEditVersion: (mcVersion: string) => void;
}

function cloneLayout(layout: HubLayout): HubLayout {
  return JSON.parse(JSON.stringify(layout)) as HubLayout;
}

let editDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let loadSavedLayoutInFlight = false;

function hubEditAllowed(state: Pick<HubBuilderState, "hubEditAccess">): boolean {
  return state.hubEditAccess === "editor";
}

function layoutUpdatedAtMs(layout: HubLayout): number {
  const t = Date.parse(layout.updatedAt ?? "");
  return Number.isFinite(t) ? t : 0;
}

function prepareLayoutForEditor(layout: HubLayout): HubLayout {
  let initial = cloneLayout(layout);
  initial = ensureAccountProfileScreen(initial);
  initial = normalizePerScreenChromeLayout(initial);
  initial = coerceLayoutWindowConsistency(initial);
  initial = syncLauncherChromeWithWindow(initial);
  initial = repairLayoutElementParents(initial, GRID_SIZE);
  return initial;
}

export const useHubBuilderStore = create<HubBuilderState>((set, get) => ({
  layout: cloneLayout(defaultHubLayout),
  editTarget: "screen",
  selectedId: null,
  selectedIds: [],
  canvasFocusRequest: null,
  elementFocusFlash: null,
  elementTreeBubble: null,
  showGrid: true,
  zoom: 1,
  autoFit: true,
  previewMode: false,
  previewFrameSize: null,
  gameMenuUiScale: 1,
  previewToasts: [],
  history: [cloneLayout(defaultHubLayout)],
  historyIndex: 0,
  clipboard: null as HubElementClipboard | null,
  editSessionActive: false,
  hubEditAccess: "pending" as const,
  hubLockHolder: null,
  contextMenu: null as ContextMenuState | null,
  scriptConsole: [] as ScriptLogEntry[],
  storageHydrated: false,
  savedFingerprint: null,
  publishedFingerprint: null,
  editorCanvasSettings: readHubEditorCanvasSettings(),
  minecraftEditVersion: "1.18.2",

  setHubEditAccess: (access, holder = null) => {
    set({ hubEditAccess: access, hubLockHolder: holder });
  },

  applyRemoteLayout: (layout) => {
    try {
      const initial = prepareLayoutForEditor(cloneLayout(layout));
      const fp = layoutFingerprint(initial);
      writeHubLayoutToStorage(initial);
      set({
        layout: initial,
        history: [initial],
        historyIndex: 0,
        selectedId: null,
        selectedIds: [],
        editSessionActive: false,
        savedFingerprint: fp,
      });
    } catch {
      /* layout remoto corrupto o incompatible */
    }
  },

  syncRemoteDraft: async () => {
    try {
      const draft = await fetchHubLayoutDraftFromApi();
      if (!draft) return false;
      const current = get().layout;
      if (layoutUpdatedAtMs(draft) <= layoutUpdatedAtMs(current)) return false;
      get().applyRemoteLayout(draft);
      return true;
    } catch {
      return false;
    }
  },

  setMinecraftEditVersion: (mcVersion) => {
    const profile = resolveVersionProfile(mcVersion);
    set((state) => ({
      minecraftEditVersion: profile.mcVersion,
      previewFrameSize: detectPrimaryDisplaySize(),
      layout: {
        ...state.layout,
        screens: state.layout.screens.map((s) => {
          if (s.id === GAME_MENU_SCREEN_ID) {
            return { ...s, width: profile.ui.menuDesignW, height: profile.ui.menuDesignH };
          }
          if (s.id === GAME_LOADING_SCREEN_ID) {
            return { ...s, width: profile.ui.loadingDesignW, height: profile.ui.loadingDesignH };
          }
          return s;
        }),
        updatedAt: new Date().toISOString(),
      },
    }));
  },

  updateEditorCanvasSettings: (patch) => {
    const next = patchHubEditorCanvasSettings(get().editorCanvasSettings, patch);
    writeHubEditorCanvasSettings(next);
    set({ editorCanvasSettings: next });
  },

  selectElement: (id) => set({ selectedId: id, selectedIds: id ? [id] : [] }),

  selectElements: (ids, primaryId) => {
    const uniq = Array.from(new Set(ids));
    const primary = primaryId ?? uniq[0] ?? null;
    set({
      selectedIds: uniq,
      selectedId: primary && uniq.includes(primary) ? primary : uniq[0] ?? null,
    });
  },

  openElementTreeBubble: (x, y) =>
    set({
      elementTreeBubble: { x, y },
      contextMenu: null,
    }),

  closeElementTreeBubble: () => set({ elementTreeBubble: null }),

  navigateToElement: ({ elementId, screenId, surface }) => {
    const state = get();
    const layout = state.layout;
    if (!layout.screens.some((s) => s.id === screenId)) return;

    const current = layout.activeScreenId;
    if (current && current !== screenId) {
      pushScreenNavHistory(current);
    }

    const token = Date.now();
    if (focusFlashClearTimer) clearTimeout(focusFlashClearTimer);

    set({
      previewMode: false,
      editTarget: "screen",
      layout: { ...layout, activeScreenId: screenId },
      selectedId: elementId,
      selectedIds: [elementId],
      autoFit: false,
      canvasFocusRequest: {
        token,
        elementId,
        screenId,
        surface,
      },
      elementFocusFlash: { elementId, token },
    });

    focusFlashClearTimer = setTimeout(() => {
      const latest = get();
      if (latest.elementFocusFlash?.token === token) {
        set({ elementFocusFlash: null });
      }
      focusFlashClearTimer = null;
    }, 1000);
  },

  setShowGrid: (show) => set({ showGrid: show }),

  setZoom: (zoom) =>
    set({
      zoom: clampHubZoom(zoom, get().editTarget),
      autoFit: false,
    }),

  setFocusZoom: (zoom) =>
    set({
      zoom: clampFocusHubZoom(zoom, get().editTarget),
      autoFit: false,
    }),

  setZoomFit: (zoom) => set({ zoom: clampHubZoom(zoom, get().editTarget) }),

  setAutoFit: (autoFit) => set({ autoFit }),

  setPreviewMode: (preview) => {
    if (preview) {
      savedShowGrid = get().showGrid;
      previewLayoutSnapshot = cloneLayout(get().layout);
      resetHubScriptRuntime();
      clearPreviewIntervals();
      const screen =
        get().layout.screens.find((s) => s.id === get().layout.activeScreenId) ??
        get().layout.screens[0];
      const isGameMenuPreview = screen?.id === GAME_MENU_SCREEN_ID;
      const isLoadingPreview = screen?.id === GAME_LOADING_SCREEN_ID;
      const isMinecraftPreview = isGameMenuPreview || isLoadingPreview;
      const chromeH = resolveLayoutChromeHeight(get().layout);
      const detected = detectPrimaryDisplaySize();
      const frameW = isMinecraftPreview
        ? detected.width
        : get().layout.window?.width ?? screen?.width ?? 980;
      const frameH = isMinecraftPreview
        ? detected.height
        : get().layout.window?.height ?? (screen ? screen.height + chromeH : 520);
      set({
        previewMode: true,
        previewFrameSize: {
          width: Math.max(320, Math.round(frameW)),
          height: Math.max(200, Math.round(frameH)),
        },
        autoFit: true,
        selectedId: null,
        selectedIds: [],
        showGrid: false,
        previewToasts: [],
        scriptConsole: [],
        contextMenu: null,
      });
      queueMicrotask(() => get().runPreviewScreenSetup());
      return;
    }

    clearPreviewIntervals();
    resetHubScriptRuntime();
    const restoreGrid = savedShowGrid;
    savedShowGrid = null;
    const snapshot = previewLayoutSnapshot;
    previewLayoutSnapshot = null;
    const screen =
      get().layout.screens.find((s) => s.id === get().layout.activeScreenId) ??
      get().layout.screens[0];
    const isMinecraftScreen =
      screen?.id === GAME_MENU_SCREEN_ID || screen?.id === GAME_LOADING_SCREEN_ID;
    set({
      previewMode: false,
      previewFrameSize: isMinecraftScreen
        ? get().previewFrameSize ?? DEFAULT_MINECRAFT_WINDOW
        : null,
      previewToasts: [],
      scriptConsole: [],
      selectedId: null,
      selectedIds: [],
      editSessionActive: false,
      ...(snapshot ? { layout: cloneLayout(snapshot) } : {}),
      ...(isMinecraftScreen ? { showGrid: false, autoFit: true } : {}),
      ...(restoreGrid !== null && !isMinecraftScreen ? { showGrid: restoreGrid } : {}),
    });
  },

  setPreviewFrameSize: (size) => set({ previewFrameSize: size, autoFit: false }),

  setGameMenuUiScale: (scale) => set({ gameMenuUiScale: scale }),

  pushPreviewToast: (message, type = "info") => {
    const entry: PreviewToast = {
      id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      message,
      type,
    };
    set((s) => ({ previewToasts: [...s.previewToasts, entry].slice(-4) }));
  },

  dismissPreviewToast: (id) =>
    set((s) => ({ previewToasts: s.previewToasts.filter((t) => t.id !== id) })),

  updateLayout: (patch) => {
    get().pushHistory();
    set((state) => ({
      layout: {
        ...state.layout,
        ...patch,
        window: patch.window ? { ...state.layout.window, ...patch.window } : state.layout.window,
        ui: patch.ui ? { ...state.layout.ui, ...patch.ui } : state.layout.ui,
        updatedAt: new Date().toISOString(),
      },
    }));
  },

  setLauncherWindowSize: (patch) => {
    const prev = get();
    const window = {
      ...prev.layout.window,
      ...patch,
      ...(patch.borderlessFullscreen
        ? { lockSize: true, borderlessFullscreen: true }
        : patch.borderlessFullscreen === false
          ? { borderlessFullscreen: false }
          : {}),
    };
    const ww = window.width;
    const wh = window.height;
    const hasW = typeof ww === "number" && Number.isFinite(ww) && ww > 0;
    const hasH = typeof wh === "number" && Number.isFinite(wh) && wh > 0;

    if (!hasW && !hasH) {
      set((state) => ({
        layout: syncLauncherChromeWithWindow({
          ...state.layout,
          window,
          updatedAt: new Date().toISOString(),
        }),
        autoFit: true,
      }));
      return;
    }

    const chromeH = resolveLayoutChromeHeight(prev.layout);
    const effectiveW = hasW ? ww! : prev.layout.window?.width ?? prev.layout.screens[0]?.width ?? 980;
    const active = prev.layout.screens.find((s) => s.id === prev.layout.activeScreenId);
    const effectiveH = hasH
      ? wh!
      : prev.layout.window?.height ?? (active ? active.height + chromeH : 520);

    if (hasW && hasH && active) {
      const { width: contentW, height: contentH } = fixedWindowContentSize(
        effectiveW,
        effectiveH,
        chromeH
      );
      const shrinking = contentW < active.width || contentH < active.height;
      if (shrinking && active.elements.length > 0) get().pushHistory();
    }

    set((state) => {
      const nextWindow = {
        ...state.layout.window,
        ...patch,
        ...(hasW ? {} : { width: effectiveW }),
        ...(hasH ? {} : { height: effectiveH }),
      };
      const layout = coerceLayoutWindowConsistency(
        syncLauncherChromeWithWindow({
          ...state.layout,
          window: nextWindow,
          updatedAt: new Date().toISOString(),
        })
      );

      return { layout, autoFit: true };
    });
  },

  runPreviewScreenSetup: () => {
    if (!get().previewMode) return;

    const layout = get().layout;
    const screen =
      layout.screens.find((s) => s.id === layout.activeScreenId) ?? layout.screens[0];
    if (!screen) return;

    for (const el of screen.elements) {
      if (!el.logic?.enabled || !el.logic.script.trim()) continue;

      if (el.logic.trigger === "load") {
        void get().runElementLogic(el.id);
      }

      if (el.logic.trigger === "interval" && el.logic.intervalMs) {
        const ms = Math.max(500, el.logic.intervalMs);
        const key = `${screen.id}:${el.id}`;
        registerPreviewInterval(
          key,
          setInterval(() => {
            if (get().previewMode) void get().runElementLogic(el.id);
          }, ms)
        );
      }
    }
  },

  setEditTarget: (target) => {
    if (get().editTarget === target) return;

    if (target === "launcher-chrome") {
      set((state) => {
        const minChromeZoom = 2;
        const nextZoom =
          state.zoom < minChromeZoom
            ? clampHubZoom(minChromeZoom, "launcher-chrome")
            : clampHubZoom(state.zoom, "launcher-chrome");
        return {
          editTarget: target,
          selectedId: null,
          selectedIds: [],
          layout: syncLauncherChromeWithWindow(state.layout),
          zoom: nextZoom,
          autoFit: false,
        };
      });
      return;
    }
    set({
      editTarget: target,
      selectedId: null,
      selectedIds: [],
      zoom: clampHubZoom(get().zoom, "screen"),
    });
  },

  getActiveScreen: () => {
    const { layout, editTarget } = get();
    if (editTarget === "launcher-chrome") {
      return launcherChromeAsScreen(layout, layout.activeScreenId);
    }
    return layout.screens.find((s) => s.id === layout.activeScreenId) ?? layout.screens[0];
  },

  setActiveScreen: (screenId, options) => {
    if (screenId === LAUNCHER_CHROME_SCREEN_ID) {
      set((state) => {
        const minChromeZoom = 2;
        const nextZoom =
          state.zoom < minChromeZoom
            ? clampHubZoom(minChromeZoom, "launcher-chrome")
            : clampHubZoom(state.zoom, "launcher-chrome");
        return {
          editTarget: "launcher-chrome",
          selectedId: null,
          selectedIds: [],
          layout: syncLauncherChromeWithWindow(state.layout),
          zoom: nextZoom,
          autoFit: false,
        };
      });
      return;
    }
    if (!get().layout.screens.some((s) => s.id === screenId)) return;
    const current = get().layout.activeScreenId;
    if (options?.recordHistory !== false && current && current !== screenId) {
      pushScreenNavHistory(current);
    }
    set((state) => ({
      layout: { ...state.layout, activeScreenId: screenId },
      selectedId: null,
      selectedIds: [],
    }));
    if (get().previewMode) {
      clearPreviewIntervals();
      queueMicrotask(() => get().runPreviewScreenSetup());
    }
  },

  goBackScreen: () => {
    const layout = get().layout;
    const current = layout.activeScreenId;
    let target = popScreenNavHistory();
    while (target && !layout.screens.some((s) => s.id === target)) {
      target = popScreenNavHistory();
    }
    if (!target) {
      const fallback =
        layout.screens.find((s) => s.id === "screen-home") ?? layout.screens[0];
      if (!fallback || fallback.id === current) {
        if (get().previewMode) {
          get().pushPreviewToast("No hay ventana anterior", "info");
        }
        return;
      }
      target = fallback.id;
    }
    get().setActiveScreen(target, { recordHistory: false });
  },

  addScreen: (name) => {
    get().pushHistory();
    const id = `screen-${Date.now()}`;
    const { layout } = get();
    const newScreen: HubScreen = {
      id,
      name: name ?? `Ventana ${layout.screens.length + 1}`,
      width: layout.screens[0]?.width ?? 980,
      height: layout.screens[0]?.height ?? 520,
      backgroundColor: "#0c0e11",
      backgroundImage: "",
      chrome: emptyScreenChromeLayout(layout),
      elements: [],
    };
    set((state) => ({
      layout: {
        ...state.layout,
        screens: [...state.layout.screens, newScreen],
        activeScreenId: id,
        updatedAt: new Date().toISOString(),
      },
      selectedId: null,
      selectedIds: [],
    }));
  },

  openGameMenuScreen: () => {
    const existing = get().layout.screens.find((s) => s.id === GAME_MENU_SCREEN_ID);
    if (existing) {
      const repair = repairGameMenuScreen(existing);
      if (repair) {
        get().pushHistory();
        set((state) => ({
          layout: {
            ...state.layout,
            screens: state.layout.screens.map((s) =>
              s.id === GAME_MENU_SCREEN_ID ? { ...s, ...repair } : s
            ),
            activeScreenId: GAME_MENU_SCREEN_ID,
            updatedAt: new Date().toISOString(),
          },
          editTarget: "screen",
          previewFrameSize: state.previewFrameSize ?? DEFAULT_MINECRAFT_WINDOW,
          showGrid: false,
          autoFit: true,
        }));
        return;
      }
      get().setActiveScreen(GAME_MENU_SCREEN_ID);
      set({
        previewFrameSize: get().previewFrameSize ?? DEFAULT_MINECRAFT_WINDOW,
        showGrid: false,
        autoFit: true,
      });
    }
    get().pushHistory();
    const screen: HubScreen = {
      id: GAME_MENU_SCREEN_ID,
      name: "Menú Minecraft",
      width: GAME_MENU_W,
      height: GAME_MENU_H,
      independentCanvas: true,
      backgroundColor: "#000000",
      backgroundImage: "",
      chrome: emptyScreenChromeLayout(get().layout),
      elements: [],
    };
    set((state) => ({
      layout: {
        ...state.layout,
        screens: [...state.layout.screens, screen],
        activeScreenId: GAME_MENU_SCREEN_ID,
        updatedAt: new Date().toISOString(),
      },
      editTarget: "screen",
      selectedId: null,
      selectedIds: [],
      previewFrameSize: DEFAULT_MINECRAFT_WINDOW,
      showGrid: false,
      autoFit: true,
    }));
  },

  openLoadingScreen: () => {
    const existing = get().layout.screens.find((s) => s.id === GAME_LOADING_SCREEN_ID);
    if (existing) {
      const repair = repairLoadingScreen(existing);
      if (repair) {
        get().pushHistory();
        set((state) => ({
          layout: {
            ...state.layout,
            screens: state.layout.screens.map((s) =>
              s.id === GAME_LOADING_SCREEN_ID ? { ...s, ...repair } : s
            ),
            activeScreenId: GAME_LOADING_SCREEN_ID,
            updatedAt: new Date().toISOString(),
          },
          editTarget: "screen",
          previewFrameSize: state.previewFrameSize ?? DEFAULT_MINECRAFT_WINDOW,
          showGrid: false,
          autoFit: true,
        }));
        return;
      }
      get().setActiveScreen(GAME_LOADING_SCREEN_ID);
      set({
        previewFrameSize: get().previewFrameSize ?? DEFAULT_MINECRAFT_WINDOW,
        showGrid: false,
        autoFit: true,
      });
      return;
    }
    get().pushHistory();
    const screen: HubScreen = {
      id: GAME_LOADING_SCREEN_ID,
      name: "Pantalla de carga",
      width: GAME_LOADING_W,
      height: GAME_LOADING_H,
      independentCanvas: true,
      backgroundColor: "#0a0b0d",
      backgroundImage: "",
      chrome: emptyScreenChromeLayout(get().layout),
      elements: defaultLoadingScreenElements(),
    };
    set((state) => ({
      layout: {
        ...state.layout,
        screens: [...state.layout.screens, screen],
        activeScreenId: GAME_LOADING_SCREEN_ID,
        updatedAt: new Date().toISOString(),
      },
      editTarget: "screen",
      selectedId: null,
      selectedIds: [],
      previewFrameSize: DEFAULT_MINECRAFT_WINDOW,
      showGrid: false,
      autoFit: true,
    }));
  },

  removeScreen: (screenId) => {
    const { layout } = get();
    if (layout.screens.length <= 1) return;
    get().pushHistory();
    const screens = layout.screens.filter((s) => s.id !== screenId);
    const activeScreenId =
      layout.activeScreenId === screenId ? screens[0]!.id : layout.activeScreenId;
    let ui = layout.ui;
    if (layout.ui?.homeScreenId === screenId) {
      ui = { ...layout.ui, homeScreenId: screens[0]!.id };
    }
    set({
      layout: { ...layout, screens, activeScreenId, ui, updatedAt: new Date().toISOString() },
      selectedId: null,
      selectedIds: [],
    });
  },

  duplicateScreen: (screenId) => {
    const src = get().layout.screens.find((s) => s.id === screenId);
    if (!src) return;
    get().pushHistory();
    const id = `screen-${Date.now()}`;
    const elements = src.elements.map((el) => ({
      ...JSON.parse(JSON.stringify(el)),
      id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    })) as HubElement[];
    const copy: HubScreen = {
      ...JSON.parse(JSON.stringify(src)),
      id,
      name: `${src.name} (copia)`,
      elements,
    };
    set((state) => ({
      layout: {
        ...state.layout,
        screens: [...state.layout.screens, copy],
        activeScreenId: id,
        updatedAt: new Date().toISOString(),
      },
      selectedId: null,
      selectedIds: [],
    }));
  },

  executeElementAction: async (elementId) => {
    if (!get().previewMode) return;

    const layout = get().layout;
    const el = findLayoutElement(layout, elementId);
    if (!el) return;

    if (hasVisibilityActions(el)) {
      const patchVis = (id: string, visible: boolean) => get().updateElement(id, { visible });
      for (const action of parseVisibilityActions(el.logic?.constants)) {
        applyVisibilityTargetList(layout, [action.target], action.op === "show", patchVis);
      }
    }

    if (el.action === "play" || el.type === "play-button" || el.type === "play-show-bind") {
      for (const hud of collectLaunchHudElements(layout)) {
        if (!hud.visible) get().updateElement(hud.id, { visible: true });
      }
    }
    const openScreen = (screenId: string) => {
      if (layout.screens.some((s) => s.id === screenId)) {
        get().setActiveScreen(screenId);
      }
    };

    if (el.logic?.enabled && el.logic.script.trim() && el.logic.trigger === "click") {
      await get().runElementLogic(elementId);
    }

    if (el.action === "external" && el.externalUrl) {
      window.open(el.externalUrl, "_blank", "noopener,noreferrer");
      return;
    }

    if (el.action === "back") {
      get().goBackScreen();
      return;
    }

    if (el.action === "hide-launch-panel" && get().previewMode) {
      get().pushPreviewToast("Vista previa: ocultar panel de descarga", "info");
      return;
    }

    if (el.action === "open-launch-log" && get().previewMode) {
      get().pushPreviewToast("Vista previa: abrir ventana de descarga", "info");
      return;
    }

    if (el.action === "play" && get().previewMode) {
      const versionId = pickForgeVersionFromLayout(layout);
      const cfg = resolveForgeVersion(versionId);
      get().pushPreviewToast(`Vista previa: lanzaría ${cfg.label}`, "success");
      return;
    }

    if (el.action === "minimize-window") {
      get().pushPreviewToast("Vista previa: minimizaría la ventana", "info");
      return;
    }

    if (el.action === "close-window") {
      get().pushPreviewToast("Vista previa: cerraría el launcher", "info");
      return;
    }

    const target = resolveActionTargetScreen(el.action, layout, el.targetScreenId);
    if (target) {
      openScreen(target);
      return;
    }

    if (el.action !== "none" && get().previewMode) {
      get().pushPreviewToast(`${actionFallbackLabel(el.action)} — crea una ventana con esa acción o usa "Ir a ventana"`, "info");
    }

    if (el.type === "counter") {
      const next = (typeof el.value === "number" ? el.value : 0) + 1;
      get().updateElement(elementId, { value: next, label: String(next) });
    }
  },

  handleRuntimeChange: async (elementId, value) => {
    get().updateElement(elementId, { value });
    const el = get().getActiveScreen().elements.find((e) => e.id === elementId);
    if (el?.logic?.enabled && el.logic.script.trim() && el.logic.trigger === "change") {
      await get().runElementLogic(elementId);
    }
  },

  updateScreen: (screenId, patch) => {
    if (!hubEditAllowed(get())) return;
    get().pushHistory();
    if (isScreenChromeVirtualId(screenId)) {
      const ownerId =
        parseScreenChromeVirtualId(screenId) ??
        get().layout.activeScreenId ??
        get().layout.screens[0]?.id;
      if (!ownerId) return;
      set((state) => {
        let nextLayout = patchScreenChromeMeta(state.layout, ownerId, {
          height: patch.height,
          backgroundColor: patch.backgroundColor,
        });
        if (patch.width !== undefined && typeof state.layout.window?.width === "number") {
          const ww = Math.max(320, Math.round(patch.width));
          nextLayout = {
            ...nextLayout,
            window: { ...state.layout.window, width: ww },
          };
        }
        return { layout: syncLauncherChromeWithWindow(nextLayout) };
      });
      return;
    }
    set((state) => ({
      layout: {
        ...state.layout,
        screens: state.layout.screens.map((s) => {
          if (s.id !== screenId) return s;
          const next = { ...s, ...patch };
          const w = patch.width ?? s.width;
          const h = patch.height ?? s.height;
          if (patch.width !== undefined || patch.height !== undefined) {
            next.elements = fitScreenElementsToBounds(s.elements, w, h);
          }
          return next;
        }),
        updatedAt: new Date().toISOString(),
      },
    }));
  },

  updateElement: (id, patch) => {
    if (!hubEditAllowed(get())) return;
    const state = get();
    if (!state.previewMode && !state.editSessionActive) {
      get().pushHistory();
      set({ editSessionActive: true });
    }

    const layout = get().layout;
    const activeScreenId = layout.activeScreenId;
    const surfaceId = resolveElementSurfaceId(layout, id, activeScreenId);
    if (!surfaceId) return;

    const ownerScreenId = resolveElementScreenId(layout, id, activeScreenId);
    const current = findHubElementById(layout, id, activeScreenId) ?? findLayoutElement(layout, id);
    if (!current) return;

    const merged: HubElement = {
      ...current,
      ...patch,
      style: patch.style ? { ...current.style, ...patch.style } : current.style,
      logic: patch.logic ? { ...current.logic, ...patch.logic } : current.logic,
      container: patch.container ? { ...current.container, ...patch.container } : current.container,
    };

    const nextClass = normalizePositionClass(
      "positionClass" in patch ? (merged.positionClass ?? "") : (current.positionClass ?? "")
    );
    const syncKeys = ["x", "y", "width", "height", "zIndex", "visible", "locked", "css"] as const;
    const hasSyncPatch =
      syncKeys.some((k) => k in patch) || "style" in patch || "logic" in patch;

    const surface = resolvePositionClassSurface(layout, id, activeScreenId);

    const isJoiningClass = "positionClass" in patch && Boolean(nextClass) && !hasSyncPatch;

    if (isJoiningClass && surface) {
      const peers = listPositionClassPeers(layout, nextClass!, surface, {
        excludeScreenId: ownerScreenId ?? undefined,
        excludeElementId: id,
      });
      const leader = pickPositionClassLeader(peers);
      if (leader) {
        Object.assign(
          merged,
          applySharedPropsToElement(merged, sharedPropsFromElement(leader))
        );
      }
    }

    let nextLayout = patchScreenOrChromeElements(layout, surfaceId, (elements) =>
      elements.map((el) => (el.id === id ? merged : el))
    );

    if ("positionClass" in patch && surface === "chrome") {
      nextLayout = patchChromeElementsById(nextLayout, id, {
        positionClass: merged.positionClass,
      });
      nextLayout = patchChromeElementsByRole(nextLayout, current, {
        positionClass: merged.positionClass,
      });
    }

    // Solo propagar a la clase cuando el usuario edita algo (no al unirse con clase vacía).
    if (nextClass && surface && hasSyncPatch && !isJoiningClass) {
      const syncPayload: Partial<ReturnType<typeof sharedPropsFromElement>> = {};
      if ("x" in patch) syncPayload.x = merged.x;
      if ("y" in patch) syncPayload.y = merged.y;
      if ("width" in patch) syncPayload.width = merged.width;
      if ("height" in patch) syncPayload.height = merged.height;
      if ("zIndex" in patch) syncPayload.zIndex = merged.zIndex;
      if ("visible" in patch) syncPayload.visible = merged.visible;
      if ("locked" in patch) syncPayload.locked = merged.locked;
      if ("style" in patch) syncPayload.style = { ...merged.style };
      if ("css" in patch) {
        syncPayload.css = merged.css ? { ...merged.css } : undefined;
      }
      if ("logic" in patch) {
        const uiConstants = sharedPropsFromElement(merged).logicConstants;
        if (uiConstants) syncPayload.logicConstants = uiConstants;
      }
      if (Object.keys(syncPayload).length > 0) {
        nextLayout = syncLayoutByPositionClass(nextLayout, nextClass, syncPayload, surface);
      }
    }

    set({ layout: nextLayout });

    if (!get().previewMode) {
      if (editDebounceTimer) clearTimeout(editDebounceTimer);
      editDebounceTimer = setTimeout(() => {
        set({ editSessionActive: false });
        editDebounceTimer = null;
      }, 600);
    }
  },

  moveElement: (id, rawX, rawY, options) => {
    if (!hubEditAllowed(get())) return;
    const layout = get().layout;
    const activeScreenId = layout.activeScreenId;
    const surfaceId = resolveElementSurfaceId(layout, id, activeScreenId);
    if (!surfaceId) return;
    const chromeOwner = resolveChromeSurfaceScreen(layout, surfaceId);
    const screen = chromeOwner
      ? launcherChromeAsScreen(layout, chromeOwner.id)
      : (layout.screens.find((s) => s.id === surfaceId) ?? get().getActiveScreen());
    const el = screen.elements.find((e) => e.id === id);
    if (!el || el.locked) return;

    const grid = resolveEditorSnapGridSize(
      isScreenChromeVirtualId(surfaceId) ? "launcher-chrome" : get().editTarget,
      get().editorCanvasSettings
    );
    const parent = el.parentId
      ? screen.elements.find((p) => p.id === el.parentId) ?? null
      : null;
    const parentAbs = parent
      ? elementAbsolutePosition(screen.elements, parent.id)
      : { x: 0, y: 0 };
    const pad = elementParentInset(parent);
    let localX = rawX - parentAbs.x - pad;
    let localY = rawY - parentAbs.y - pad;
    const shouldSnap = options?.snap !== false;
    if (shouldSnap) {
      localX = snapToGrid(localX, grid);
      localY = snapToGrid(localY, grid);
    }
    const { width: boundsW, height: boundsH } = elementEditorBounds(
      screen.elements,
      el,
      screen.width,
      screen.height
    );
    const clamped = clampElement(localX, localY, el.width, el.height, boundsW, boundsH);
    const positionClass = normalizePositionClass(el.positionClass ?? "");
    const surface = resolvePositionClassSurface(layout, id, activeScreenId);

    set((state) => {
      let nextLayout = patchScreenOrChromeElements(state.layout, surfaceId, (elements) =>
        elements.map((item) => (item.id === id ? { ...item, x: clamped.x, y: clamped.y } : item))
      );
      if (positionClass && surface) {
        nextLayout = syncLayoutByPositionClass(
          nextLayout,
          positionClass,
          { x: clamped.x, y: clamped.y },
          surface
        );
      }
      return { layout: nextLayout };
    });
  },

  resizeElement: (id, patch) => {
    if (!hubEditAllowed(get())) return;
    const layout = get().layout;
    const activeScreenId = layout.activeScreenId;
    const surfaceId = resolveElementSurfaceId(layout, id, activeScreenId);
    if (!surfaceId) return;
    const chromeOwner = resolveChromeSurfaceScreen(layout, surfaceId);
    const screen = chromeOwner
      ? launcherChromeAsScreen(layout, chromeOwner.id)
      : (layout.screens.find((s) => s.id === surfaceId) ?? get().getActiveScreen());
    const el = screen.elements.find((e) => e.id === id);
    if (!el || el.locked) return;

    const positionClass = normalizePositionClass(el.positionClass ?? "");
    const surface = resolvePositionClassSurface(layout, id, activeScreenId);

    set((state) => {
      let nextLayout = patchScreenOrChromeElements(state.layout, surfaceId, (elements) =>
        elements.map((item) => (item.id === id ? { ...item, ...patch } : item))
      );
      if (positionClass && surface) {
        nextLayout = syncLayoutByPositionClass(
          nextLayout,
          positionClass,
          { x: patch.x, y: patch.y, width: patch.width, height: patch.height },
          surface
        );
      }
      return { layout: nextLayout };
    });
  },

  syncPositionClassFromElement: (id) => {
    const layout = get().layout;
    const activeScreenId = layout.activeScreenId;
    const ownerScreenId = resolveElementScreenId(layout, id, activeScreenId);
    const el = findHubElementById(layout, id, activeScreenId) ?? findLayoutElement(layout, id);
    if (!el || !ownerScreenId) return 0;

    const positionClass = normalizePositionClass(el.positionClass ?? "");
    const surface = resolvePositionClassSurface(layout, id, activeScreenId);
    if (!positionClass || !surface) return 0;

    const peers = listPositionClassPeers(layout, positionClass, surface, {
      excludeScreenId: ownerScreenId,
      excludeElementId: id,
    });
    if (peers.length === 0) return 0;

    if (!get().previewMode) get().pushHistory();

    const nextLayout = syncLayoutByPositionClass(
      layout,
      positionClass,
      sharedPropsFromElement(el),
      surface
    );
    set({ layout: nextLayout });
    return peers.length;
  },

  addElement: (paletteIdOrType) => {
    get().addElementAt(paletteIdOrType, 0, 0, { mode: "palette" });
  },

  addElementAt: (paletteIdOrType, rawX, rawY, options) => {
    get().pushHistory();
    const mode: AddPlacementMode = options?.mode ?? "canvas";
    const { layout, editTarget } = get();
    const palette = resolvePaletteItem(layout, paletteIdOrType);
    if (!palette) return;

    const toChrome = paletteTargetsChrome(palette) || editTarget === "launcher-chrome";
    const screen = toChrome
      ? launcherChromeAsScreen(layout, layout.activeScreenId)
      : get().getActiveScreen();
    const maxZ = screen.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
    const existingRefs = collectAllRefIds(layout);
    const grid = resolveEditorSnapGridSize(toChrome ? "launcher-chrome" : editTarget, get().editorCanvasSettings);
    const repaired = repairInvalidElementParents(screen.elements, grid);
    const placement = resolveNewElementPlacement({
      mode,
      screen,
      elements: repaired,
      width: palette.defaultWidth,
      height: palette.defaultHeight,
      grid,
      rawX,
      rawY,
      selectedId: get().selectedId,
    });

    if (palette.id === "launch.panel" || palette.type === "launch-panel") {
      let topX = placement.x;
      let topY = placement.y;
      if (placement.parentId) {
        const pAbs = elementAbsolutePosition(repaired, placement.parentId);
        topX = pAbs.x + placement.x;
        topY = pAbs.y + placement.y;
      }
      const bundle = createLaunchPanelBundle({
        x: topX,
        y: topY,
        zIndex: maxZ + 1,
        existingRefs,
        panelWidth: palette.defaultWidth,
      });
      set((state) => ({
        layout: patchScreenOrChromeElements(state.layout, screen.id, (elements) => [
          ...repairInvalidElementParents(elements, grid),
          ...bundle,
        ]),
        selectedId: bundle[0]?.id ?? null,
        selectedIds: bundle[0] ? [bundle[0].id] : [],
      }));
      return;
    }

    const newEl = buildElement(
      paletteIdOrType,
      placement.x,
      placement.y,
      maxZ + 1,
      existingRefs,
      grid,
      layout
    );
    if (!newEl) return;
    if (placement.parentId) newEl.parentId = placement.parentId;

    const surfaceId = toChrome ? screenChromeVirtualId(layout.activeScreenId) : screen.id;

    set((state) => ({
      layout: patchScreenOrChromeElements(state.layout, surfaceId, (elements) => [
        ...repairInvalidElementParents(elements, grid),
        newEl,
      ]),
      editTarget: toChrome ? "launcher-chrome" : state.editTarget,
      selectedId: newEl.id,
      selectedIds: [newEl.id],
    }));
  },

  removeElement: (id) => {
    get().removeElements([id]);
  },

  removeElements: (ids) => {
    const uniq = Array.from(new Set(ids));
    if (!uniq.length) return;
    get().pushHistory();
    const layout = get().layout;
    const bySurface = new Map<string, string[]>();

    for (const id of uniq) {
      const surfaceId = resolveElementSurfaceId(layout, id);
      if (!surfaceId) continue;
      const chromeOwner = resolveChromeSurfaceScreen(layout, surfaceId);
      const screen = chromeOwner
        ? launcherChromeAsScreen(layout, chromeOwner.id)
        : (layout.screens.find((s) => s.id === surfaceId) ?? null);
      if (!screen) continue;

      const pending = bySurface.get(surfaceId) ?? [];
      pending.push(id);
      bySurface.set(surfaceId, pending);
    }

    const idsToRemove = new Set<string>();
    for (const [surfaceId, surfaceRootIds] of bySurface) {
      const chromeOwner = resolveChromeSurfaceScreen(layout, surfaceId);
      const screen = chromeOwner
        ? launcherChromeAsScreen(layout, chromeOwner.id)
        : (layout.screens.find((s) => s.id === surfaceId) ?? null);
      if (!screen) continue;
      for (const id of collectSubtreeIds(screen.elements, surfaceRootIds)) {
        idsToRemove.add(id);
      }
    }

    if (idsToRemove.size === 0) return;

    const removeList = Array.from(idsToRemove);
    const bySurfaceExpanded = new Map<string, string[]>();
    for (const id of removeList) {
      const surfaceId = resolveElementSurfaceId(layout, id);
      if (!surfaceId) continue;
      const list = bySurfaceExpanded.get(surfaceId) ?? [];
      list.push(id);
      bySurfaceExpanded.set(surfaceId, list);
    }

    set((state) => {
      let nextLayout = state.layout;
      for (const [surfaceId, surfaceIds] of bySurfaceExpanded) {
        nextLayout = patchScreenOrChromeElements(nextLayout, surfaceId, (elements) =>
          elements.filter((e) => !surfaceIds.includes(e.id))
        );
      }
      return {
        layout: nextLayout,
        selectedId: removeList.includes(state.selectedId ?? "") ? null : state.selectedId,
        selectedIds: (state.selectedIds ?? []).filter((x) => !removeList.includes(x)),
      };
    });
  },

  duplicateElement: (id) => {
    const layout = get().layout;
    const surfaceId = resolveElementSurfaceId(layout, id);
    if (!surfaceId) return;
    const chromeOwner = resolveChromeSurfaceScreen(layout, surfaceId);
    const screen = chromeOwner
      ? launcherChromeAsScreen(layout, chromeOwner.id)
      : (layout.screens.find((s) => s.id === surfaceId) ?? get().getActiveScreen());
    const el = screen.elements.find((e) => e.id === id);
    if (!el) return;

    get().pushHistory();
    const grid = resolveEditorSnapGridSize(
      isScreenChromeVirtualId(surfaceId) ? "launcher-chrome" : get().editTarget,
      get().editorCanvasSettings
    );
    const clip = createElementClipboard(screen.elements, id);
    if (!clip) return;

    const maxZ = screen.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
    const { elements: duplicated, rootId } = instantiateClipboardSubtree(
      clip,
      {
        x: snapToGrid(el.x + 16, grid),
        y: snapToGrid(el.y + 16, grid),
        parentId: el.parentId,
      },
      maxZ
    );

    set((state) => ({
      layout: patchScreenOrChromeElements(state.layout, surfaceId, (elements) => [...elements, ...duplicated]),
      selectedId: rootId,
      selectedIds: duplicated.map((e) => e.id),
      editTarget: isScreenChromeVirtualId(surfaceId) ? "launcher-chrome" : state.editTarget,
    }));
  },

  reorderElement: (id, direction) => {
    get().pushHistory();
    const screen = get().getActiveScreen();
    set((state) => ({
      layout: patchScreenOrChromeElements(state.layout, screen.id, (elements) => {
        const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
        const idx = sorted.findIndex((e) => e.id === id);
        if (idx === -1) return elements;
        const swapIdx = direction === "up" ? idx + 1 : idx - 1;
        if (swapIdx < 0 || swapIdx >= sorted.length) return elements;
        const a = sorted[idx];
        const b = sorted[swapIdx];
        return elements.map((el) => {
          if (el.id === a.id) return { ...el, zIndex: b.zIndex };
          if (el.id === b.id) return { ...el, zIndex: a.zIndex };
          return el;
        });
      }),
    }));
  },

  bringToFront: (id) => {
    const screen = get().getActiveScreen();
    const maxZ = screen.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
    get().updateElement(id, { zIndex: maxZ + 1 });
  },

  sendToBack: (id) => {
    const screen = get().getActiveScreen();
    const minZ = screen.elements.reduce((m, e) => Math.min(m, e.zIndex), 0);
    get().updateElement(id, { zIndex: minZ - 1 });
  },

  nudgeElement: (id, dx, dy) => {
    const screen = get().getActiveScreen();
    const el = screen.elements.find((e) => e.id === id);
    if (!el || el.locked) return;
    get().pushHistory();
    const abs = elementAbsolutePosition(screen.elements, id);
    get().moveElement(id, abs.x + dx, abs.y + dy);
  },

  alignElement: (id, align) => {
    get().pushHistory();
    const screen = get().getActiveScreen();
    const el = screen.elements.find((e) => e.id === id);
    if (!el || el.locked) return;
    const parent = el.parentId ? screen.elements.find((e) => e.id === el.parentId) : null;
    const parentDisplay = parent?.container?.display ?? "absolute";
    const pad = parentDisplay === "absolute" ? 0 : Math.max(0, Number(parent?.container?.padding ?? 0));
    const boundsW = parent ? Math.max(0, parent.width - pad * 2) : screen.width;
    const boundsH = parent ? Math.max(0, parent.height - pad * 2) : screen.height;

    const grid = resolveEditorSnapGridSize(get().editTarget, get().editorCanvasSettings);
    let x = el.x;
    let y = el.y;

    switch (align) {
      case "left":
        x = 0;
        break;
      case "center-h":
        x = snapCenterAxis(boundsW, el.width, grid);
        break;
      case "right":
        x = Math.max(0, boundsW - el.width);
        break;
      case "top":
        y = 0;
        break;
      case "center-v":
        y = snapCenterAxis(boundsH, el.height, grid);
        break;
      case "bottom":
        y = Math.max(0, boundsH - el.height);
        break;
    }

    const clamped = clampElement(x, y, el.width, el.height, boundsW, boundsH);
    get().updateElement(id, { x: clamped.x, y: clamped.y });
  },

  toggleLock: (id) => {
    const el = get().getActiveScreen().elements.find((e) => e.id === id);
    if (!el) return;
    get().updateElement(id, { locked: !el.locked });
  },

  toggleVisible: (id) => {
    const el = get().getActiveScreen().elements.find((e) => e.id === id);
    if (!el) return;
    get().updateElement(id, { visible: !el.visible });
  },

  copyElement: (id) => {
    const screen = get().getActiveScreen();
    const clip = createElementClipboard(screen.elements, id);
    if (!clip) return;
    set({ clipboard: clip });
  },

  pasteElement: (atX, atY, insideParentId) => {
    const clip = normalizeElementClipboard(get().clipboard);
    if (!clip) return;

    get().pushHistory();
    const screen = get().getActiveScreen();
    const grid = resolveEditorSnapGridSize(
      isScreenChromeVirtualId(screen.id) ? "launcher-chrome" : get().editTarget,
      get().editorCanvasSettings
    );
    const maxZ = screen.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
    const repaired = repairInvalidElementParents(screen.elements, grid);
    const placement = resolvePastePlacement({
      screen,
      elements: repaired,
      clipboard: clip,
      grid,
      selectedId: get().selectedId,
      insideParentId,
      atX,
      atY,
    });

    const { elements: pastedElements, rootId } = instantiateClipboardSubtree(clip, placement, maxZ);

    const surfaceId = isScreenChromeVirtualId(screen.id)
      ? screenChromeVirtualId(get().layout.activeScreenId)
      : screen.id;

    set((state) => ({
      layout: patchScreenOrChromeElements(state.layout, surfaceId, (elements) => [
        ...repairInvalidElementParents(elements, grid),
        ...pastedElements,
      ]),
      selectedId: rootId,
      selectedIds: pastedElements.map((e) => e.id),
    }));
  },

  selectNextElement: (direction) => {
    const screen = get().getActiveScreen();
    const sorted = [...screen.elements].sort((a, b) => a.zIndex - b.zIndex);
    if (sorted.length === 0) return;

    const { selectedId } = get();
    if (!selectedId) {
      const id = sorted[direction === 1 ? 0 : sorted.length - 1].id;
      set({ selectedId: id, selectedIds: [id] });
      return;
    }

    const idx = sorted.findIndex((e) => e.id === selectedId);
    const next = sorted[(idx + direction + sorted.length) % sorted.length];
    set({ selectedId: next.id, selectedIds: [next.id] });
  },

  pushHistory: () => {
    if (!hubEditAllowed(get())) return;
    const { layout, history, historyIndex } = get();
    const next = history.slice(0, historyIndex + 1);
    next.push(cloneLayout(layout));
    if (next.length > 40) next.shift();
    set({ history: next, historyIndex: next.length - 1 });
  },

  undo: () => {
    if (!hubEditAllowed(get())) return;
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    if (editDebounceTimer) clearTimeout(editDebounceTimer);
    editDebounceTimer = null;
    const newIndex = historyIndex - 1;
    set({
      layout: cloneLayout(history[newIndex]),
      historyIndex: newIndex,
      selectedId: null,
      selectedIds: [],
      editSessionActive: false,
    });
  },

  redo: () => {
    if (!hubEditAllowed(get())) return;
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    if (editDebounceTimer) clearTimeout(editDebounceTimer);
    editDebounceTimer = null;
    const newIndex = historyIndex + 1;
    set({
      layout: cloneLayout(history[newIndex]),
      historyIndex: newIndex,
      selectedId: null,
      selectedIds: [],
      editSessionActive: false,
    });
  },

  resetLayout: () => {
    if (!hubEditAllowed(get())) return;
    clearScreenNavHistory();
    // "Restablecer" vuelve al último guardado (localStorage o server), no al layout de fábrica.
    const local = readHubLayoutFromStorage();
    if (local) {
      const copy = cloneLayout(local);
      const fp = layoutFingerprint(copy);
      set({
        layout: copy,
        selectedId: null,
        selectedIds: [],
        history: [copy],
        historyIndex: 0,
        contextMenu: null,
        scriptConsole: [],
        editSessionActive: false,
        savedFingerprint: fp,
      });
      return;
    }

    // Fallback: si no hay nada guardado local, usar defaults tal cual (sin inyectar).
    const fresh = cloneLayout(defaultHubLayout);
    const fp = layoutFingerprint(fresh);
    set({
      layout: fresh,
      selectedId: null,
      selectedIds: [],
      history: [fresh],
      historyIndex: 0,
      contextMenu: null,
      scriptConsole: [],
      editSessionActive: false,
      savedFingerprint: fp,
    });
  },

  saveLayout: () => {
    if (!hubEditAllowed(get())) return false;
    const layout = cloneLayout(get().layout);
    layout.updatedAt = new Date().toISOString();
    const ok = writeHubLayoutToStorage(layout);
    if (ok) {
      set({ layout, savedFingerprint: layoutFingerprint(layout) });
    } else {
      set({ layout });
    }
    void saveHubLayoutDraftToApi(layout);
    return ok;
  },

  loadSavedLayout: async () => {
    if (get().storageHydrated) return Boolean(get().savedFingerprint);
    if (loadSavedLayoutInFlight) return false;
    loadSavedLayoutInFlight = true;

    try {
      const local = readHubLayoutFromStorage();
      const [serverDraft, published] = await Promise.all([
        fetchHubLayoutDraftFromApi(),
        fetchHubLayoutFromApi({ timeoutMs: 8_000 }),
      ]);
      const seed = pickNewestHubLayout(local, serverDraft, published);
      const initial = prepareLayoutForEditor(
        seed ? cloneLayout(seed) : cloneLayout(defaultHubLayout)
      );
      const fp = layoutFingerprint(initial);
      const publishedFp = published ? layoutFingerprint(published) : null;

      if (seed && seed !== local) {
        writeHubLayoutToStorage(initial);
      } else if (local) {
        const localFp = layoutFingerprint(local);
        if (localFp !== fp) {
          initial.updatedAt = new Date().toISOString();
          writeHubLayoutToStorage(initial);
        }
      }

      set({
        storageHydrated: true,
        layout: initial,
        history: [initial],
        historyIndex: 0,
        selectedId: null,
        selectedIds: [],
        editSessionActive: false,
        savedFingerprint: seed ? fp : null,
        publishedFingerprint: publishedFp,
      });

      return Boolean(seed);
    } catch {
      const fresh = prepareLayoutForEditor(cloneLayout(defaultHubLayout));
      const fp = layoutFingerprint(fresh);
      set({
        storageHydrated: true,
        layout: fresh,
        history: [fresh],
        historyIndex: 0,
        selectedId: null,
        selectedIds: [],
        editSessionActive: false,
        savedFingerprint: null,
        publishedFingerprint: null,
      });
      return false;
    } finally {
      loadSavedLayoutInFlight = false;
    }
  },

  publishLayout: async () => {
    if (!hubEditAllowed(get())) return false;
    const layout = ensureAccountProfileScreen(
      normalizeLaunchLayout(
        syncLauncherChromeWithWindow(
          coerceLayoutWindowConsistency(normalizePerScreenChromeLayout(cloneLayout(get().layout)))
        ),
        { resetLaunchVisibility: true }
      )
    );
    layout.updatedAt = new Date().toISOString();
    set({ layout });
    writeHubLayoutToStorage(layout);
    // Exporta el menú de Minecraft (si existe) al endpoint que consume el juego
    try {
      if (layout.screens.some((s) => s.id === GAME_MENU_SCREEN_ID)) {
        await fetch("/api/game-ui", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(exportGameUi(layout)),
        });
      }
      if (layout.screens.some((s) => s.id === GAME_LOADING_SCREEN_ID)) {
        await fetch("/api/loading-ui", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(exportLoadingUi(layout)),
        });
      }
    } catch {
      /* el panel/juego seguirá con el último JSON */
    }
    const ok = await publishHubLayoutToApi(stripMinecraftEditorScreens(layout));
    if (ok) {
      const fp = layoutFingerprint(layout);
      set({ layout, savedFingerprint: fp, publishedFingerprint: fp });
    } else {
      set({ layout });
    }
    return ok;
  },

  openContextMenu: (menu) => set({ contextMenu: menu, elementTreeBubble: null }),

  closeContextMenu: () => set({ contextMenu: null }),

  clearScriptConsole: () => set({ scriptConsole: [] }),

  runElementLogic: async (id) => {
    const runAtDepth = async (targetId: string, depth: number): Promise<ScriptRunResult | null> => {
      const target = get().getActiveScreen().elements.find((e) => e.id === targetId);
      if (!target?.logic?.enabled || !target.logic.script.trim()) return null;

      const callbacks = {
        updateElement: (elId: string, patch: Partial<HubElement>) => get().updateElement(elId, patch),
        getElementById: (elId: string) =>
          get().getActiveScreen().elements.find((e) => e.id === elId) ?? null,
        getElementByRef: (refId: string) => findElementByRef(get().getActiveScreen(), refId),
        getAllElements: () => get().getActiveScreen().elements,
        getActiveScreenId: () => get().layout.activeScreenId,
        setActiveScreen: (screenId: string) => get().setActiveScreen(screenId),
        goBackScreen: () => get().goBackScreen(),
        runLogicByRef: (refId: string, d: number) => {
          const other = findElementByRef(get().getActiveScreen(), refId);
          return other ? runAtDepth(other.id, depth + d) : Promise.resolve(null);
        },
        runLogicById: (elId: string, d: number) => runAtDepth(elId, depth + d),
        onEmit: (event: string, data?: unknown) => {
          if (event === "toast" && data && typeof data === "object" && "message" in data) {
            const msg = String((data as { message: string }).message);
            const type = "type" in data ? String((data as { type?: string }).type ?? "info") : "info";
            if (get().previewMode) get().pushPreviewToast(msg, type);
            else if (typeof window !== "undefined") console.info("[Hub Toast]", msg);
          }
          if (event === "navigate" && data && typeof data === "object") {
            if ("back" in data && (data as { back?: boolean }).back) {
              get().goBackScreen();
            } else if ("screen" in data) {
              get().setActiveScreen(String((data as { screen: string }).screen));
            } else if ("action" in data) {
              const target = resolveActionTargetScreen(
                String((data as { action: string }).action) as HubElement["action"],
                get().layout
              );
              if (target) get().setActiveScreen(target);
            }
          }
        },
      };

      return runHubScript(target, target.logic!.script, callbacks, depth);
    };

    const el = get().getActiveScreen().elements.find((e) => e.id === id);
    if (!el) return;

    if (isVisibilityRuleElement(el) && !el.logic?.script?.trim()) {
      const layout = get().layout;
      const patchVis = (elementId: string, visible: boolean) => get().updateElement(elementId, { visible });
      for (const action of parseVisibilityActions(el.logic?.constants)) {
        applyVisibilityTargetList(
          layout,
          [action.target],
          action.op === "show",
          patchVis
        );
      }
      set((s) => ({
        scriptConsole: [
          {
            id: `log-${Date.now()}`,
            elementId: id,
            refId: el.logic?.refId,
            label: el.label,
            success: true,
            message: "Visibilidad aplicada (vista previa)",
            timestamp: new Date().toISOString(),
          },
          ...s.scriptConsole,
        ].slice(0, 30),
      }));
      return;
    }

    const result = await runAtDepth(id, 0);
    if (!result) return;

    const entry: ScriptLogEntry = {
      id: `log-${Date.now()}`,
      elementId: id,
      refId: el.logic?.refId,
      label: el.label,
      success: result.success,
      message: result.message,
      timestamp: new Date().toISOString(),
    };

    set((s) => ({
      scriptConsole: [entry, ...s.scriptConsole].slice(0, 30),
    }));
  },
}));
