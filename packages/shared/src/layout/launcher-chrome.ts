import type { HubElement, HubLayout, HubScreen, LauncherChromeLayout } from "../types/hub-layout";
import {
  CHROME_VISIBLE_SCREENS_KEY,
  chromeElementVisibleOnScreen,
} from "./hub-chrome-visibility";
import { fitScreenElementsToBounds, MIN_ELEMENT_WIDTH } from "./hub-viewport";

/** ID virtual legacy (migración). Preferir `{screenId}::chrome`. */
export const LAUNCHER_CHROME_SCREEN_ID = "__launcher-chrome__";
export const SCREEN_CHROME_VIRTUAL_SUFFIX = "::chrome";
export const DEFAULT_LAUNCHER_CHROME_WIDTH = 920;
export const DEFAULT_LAUNCHER_CHROME_HEIGHT = 40;

export function screenChromeVirtualId(screenId: string): string {
  return `${screenId}${SCREEN_CHROME_VIRTUAL_SUFFIX}`;
}

export function parseScreenChromeVirtualId(virtualId: string): string | null {
  if (virtualId === LAUNCHER_CHROME_SCREEN_ID) return null;
  if (!virtualId.endsWith(SCREEN_CHROME_VIRTUAL_SUFFIX)) return null;
  return virtualId.slice(0, -SCREEN_CHROME_VIRTUAL_SUFFIX.length) || null;
}

export function isScreenChromeVirtualId(id: string): boolean {
  return id === LAUNCHER_CHROME_SCREEN_ID || id.endsWith(SCREEN_CHROME_VIRTUAL_SUFFIX);
}

function resolveChromeOwnerScreenId(layout: HubLayout, surfaceId: string): string | null {
  const parsed = parseScreenChromeVirtualId(surfaceId);
  if (parsed && layout.screens.some((s) => s.id === parsed)) return parsed;
  if (surfaceId === LAUNCHER_CHROME_SCREEN_ID) {
    const active = layout.screens.find((s) => s.id === layout.activeScreenId);
    return active?.id ?? layout.screens[0]?.id ?? null;
  }
  return null;
}

function stripChromeVisibilityConstant(el: HubElement): HubElement {
  const constants = el.logic?.constants;
  if (!constants || constants[CHROME_VISIBLE_SCREENS_KEY] === undefined) return el;
  const next = { ...constants };
  delete next[CHROME_VISIBLE_SCREENS_KEY];
  return {
    ...el,
    logic: el.logic ? { ...el.logic, constants: Object.keys(next).length ? next : undefined } : el.logic,
  };
}

/** Escala posiciones de la barra cuando cambia el ancho de coordenadas (p. ej. ventana del layout). */
export function scaleLauncherChromeElements(
  elements: HubElement[],
  fromWidth: number,
  toWidth: number
): HubElement[] {
  if (!elements.length || fromWidth <= 0 || toWidth <= 0 || fromWidth === toWidth) {
    return elements;
  }
  const scale = toWidth / fromWidth;
  return elements.map((el) => ({
    ...el,
    x: Math.round(el.x * scale),
    width: Math.max(MIN_ELEMENT_WIDTH, Math.round(el.width * scale)),
  }));
}

/** Posición/tamaño en px para renderizar la barra a un ancho distinto al de diseño. */
export function scaleChromeElementLayout(
  element: Pick<HubElement, "x" | "y" | "width" | "height">,
  scaleX: number
): Pick<HubElement, "x" | "y" | "width" | "height"> {
  if (!Number.isFinite(scaleX) || scaleX <= 0 || scaleX === 1) {
    return { x: element.x, y: element.y, width: element.width, height: element.height };
  }
  return {
    x: Math.round(element.x * scaleX),
    y: element.y,
    width: Math.max(MIN_ELEMENT_WIDTH, Math.round(element.width * scaleX)),
    height: element.height,
  };
}

/** Ancho efectivo de la barra = ancho de la ventana del launcher cuando está definido. */
export function resolveLauncherChromeWidth(layout: HubLayout): number {
  const ww = layout.window?.width;
  if (typeof ww === "number" && Number.isFinite(ww) && ww > 0) {
    return Math.max(320, Math.round(ww));
  }
  const active = layout.screens.find((s) => s.id === layout.activeScreenId) ?? layout.screens[0];
  const cw = active?.chrome?.width ?? layout.launcherChrome?.width;
  if (typeof cw === "number" && Number.isFinite(cw) && cw > 0) {
    return Math.max(320, Math.round(cw));
  }
  return DEFAULT_LAUNCHER_CHROME_WIDTH;
}

export function emptyScreenChromeLayout(layout: HubLayout): LauncherChromeLayout {
  return {
    width: resolveLauncherChromeWidth(layout),
    height: DEFAULT_LAUNCHER_CHROME_HEIGHT,
    backgroundColor: "#0a0b0d",
    elements: [],
  };
}

/** Barra vacía (solo dimensiones) — sin elementos precargados. */
export function emptyLauncherChromeLayout(layout?: HubLayout): LauncherChromeLayout {
  if (layout) return emptyScreenChromeLayout(layout);
  return {
    width: DEFAULT_LAUNCHER_CHROME_WIDTH,
    height: DEFAULT_LAUNCHER_CHROME_HEIGHT,
    backgroundColor: "#0a0b0d",
    elements: [],
  };
}

export function ensureScreenChrome(screen: HubScreen, layout: HubLayout): LauncherChromeLayout {
  const width = resolveLauncherChromeWidth(layout);
  const prev = screen.chrome;
  if (prev) {
    return {
      width,
      height: prev.height ?? DEFAULT_LAUNCHER_CHROME_HEIGHT,
      backgroundColor: prev.backgroundColor ?? "#0a0b0d",
      elements: prev.elements ?? [],
    };
  }
  return emptyScreenChromeLayout(layout);
}

/** @deprecated Usa `ensureScreenChrome`. */
export function ensureLauncherChrome(layout: HubLayout, screenId?: string): LauncherChromeLayout {
  const sid = screenId ?? layout.activeScreenId;
  const screen = layout.screens.find((s) => s.id === sid) ?? layout.screens[0];
  if (!screen) return emptyScreenChromeLayout(layout);
  if (screen.chrome) return ensureScreenChrome(screen, layout);
  if (layout.launcherChrome) {
    return {
      width: resolveLauncherChromeWidth(layout),
      height: layout.launcherChrome.height ?? DEFAULT_LAUNCHER_CHROME_HEIGHT,
      backgroundColor: layout.launcherChrome.backgroundColor ?? "#0a0b0d",
      elements: layout.launcherChrome.elements ?? [],
    };
  }
  return emptyScreenChromeLayout(layout);
}

export function hasScreenChromeContent(screen: HubScreen): boolean {
  return (screen.chrome?.elements?.length ?? 0) > 0;
}

/** Hay barra personalizada (al menos un elemento) en alguna ventana o legacy global. */
export function hasLauncherChromeContent(layout: HubLayout, screenId?: string): boolean {
  if (screenId) {
    const screen = layout.screens.find((s) => s.id === screenId);
    return screen ? hasScreenChromeContent(screen) : false;
  }
  if ((layout.launcherChrome?.elements?.length ?? 0) > 0) return true;
  return layout.screens.some(hasScreenChromeContent);
}

function normalizeScreenChrome(
  screen: HubScreen,
  layout: HubLayout,
  targetW: number
): HubScreen {
  const chrome = ensureScreenChrome(screen, layout);
  const fromW =
    typeof chrome.width === "number" && Number.isFinite(chrome.width) && chrome.width > 0
      ? Math.round(chrome.width)
      : targetW;
  const targetH = chrome.height ?? DEFAULT_LAUNCHER_CHROME_HEIGHT;
  let elements = chrome.elements;
  if (fromW !== targetW && elements.length > 0) {
    elements = scaleLauncherChromeElements(elements, fromW, targetW);
  }
  return {
    ...screen,
    chrome: {
      ...chrome,
      width: targetW,
      height: targetH,
      elements,
    },
  };
}

/** Migra `layout.launcherChrome` global → `screen.chrome` por ventana. */
export function migrateGlobalChromeToScreens(layout: HubLayout): HubLayout {
  const global = layout.launcherChrome;
  const hasPerScreenContent = layout.screens.some((s) => (s.chrome?.elements?.length ?? 0) > 0);

  if (!global?.elements?.length) {
    const screens = layout.screens.map((s) =>
      s.chrome
        ? s
        : { ...s, chrome: emptyScreenChromeLayout(layout) }
    );
    const { launcherChrome: _removed, ...rest } = layout;
    return { ...rest, screens };
  }

  if (hasPerScreenContent) {
    const screens = layout.screens.map((s) =>
      s.chrome ? s : { ...s, chrome: emptyScreenChromeLayout(layout) }
    );
    const { launcherChrome: _removed, ...rest } = layout;
    return { ...rest, screens };
  }

  const screens = layout.screens.map((screen) => {
    if (screen.chrome?.elements?.length) return screen;
    const elements = global.elements
      .filter((el) => chromeElementVisibleOnScreen(el, screen.id))
      .map((el) => stripChromeVisibilityConstant(JSON.parse(JSON.stringify(el)) as HubElement));
    return {
      ...screen,
      chrome: {
        width: global.width ?? resolveLauncherChromeWidth(layout),
        height: global.height ?? DEFAULT_LAUNCHER_CHROME_HEIGHT,
        backgroundColor: global.backgroundColor ?? "#0a0b0d",
        elements,
      },
    };
  });

  const { launcherChrome: _removed, ...rest } = layout;
  return { ...rest, screens };
}

/** Alinea anchos de todas las barras con la ventana y migra chrome global si hace falta. */
export function normalizePerScreenChromeLayout(layout: HubLayout): HubLayout {
  let next = migrateGlobalChromeToScreens(layout);
  const targetW = resolveLauncherChromeWidth(next);
  const screens = next.screens.map((s) => normalizeScreenChrome(s, next, targetW));
  return { ...next, screens };
}

/** Mantiene barras alineadas con `layout.window.width`. */
export function syncLauncherChromeWithWindow(layout: HubLayout): HubLayout {
  return normalizePerScreenChromeLayout(layout);
}

/** @deprecated Alias de `normalizePerScreenChromeLayout`. */
export function normalizeLauncherChromeLayout(layout: HubLayout): HubLayout {
  return normalizePerScreenChromeLayout(layout);
}

/** @deprecated Usa `emptyScreenChromeLayout`. */
export function defaultLauncherChromeLayout(layout?: HubLayout): LauncherChromeLayout {
  return emptyLauncherChromeLayout(layout);
}

/** Pantalla virtual para editar la barra de una ventana en Hub Builder. */
export function screenChromeAsVirtualScreen(screen: HubScreen, layout: HubLayout): HubScreen {
  const chrome = ensureScreenChrome(screen, layout);
  return {
    id: screenChromeVirtualId(screen.id),
    name: `Barra superior · ${screen.name}`,
    width: chrome.width,
    height: chrome.height,
    backgroundColor: chrome.backgroundColor ?? "#0a0b0d",
    elements: chrome.elements,
    scroll: false,
  };
}

export function launcherChromeAsScreen(layout: HubLayout, screenId?: string): HubScreen {
  const sid = screenId ?? layout.activeScreenId;
  const screen = layout.screens.find((s) => s.id === sid) ?? layout.screens[0];
  return screenChromeAsVirtualScreen(screen, layout);
}

export function patchScreenChromeElements(
  layout: HubLayout,
  screenId: string,
  updater: (elements: HubElement[]) => HubElement[]
): HubLayout {
  return {
    ...layout,
    updatedAt: new Date().toISOString(),
    screens: layout.screens.map((s) => {
      if (s.id !== screenId) return s;
      const chrome = ensureScreenChrome(s, layout);
      return {
        ...s,
        chrome: {
          ...chrome,
          width: resolveLauncherChromeWidth(layout),
          elements: updater(chrome.elements),
        },
      };
    }),
  };
}

/** @deprecated Usa `patchScreenChromeElements`. */
export function patchLauncherChromeElements(
  layout: HubLayout,
  updater: (elements: HubElement[]) => HubElement[]
): HubLayout {
  const sid = layout.activeScreenId ?? layout.screens[0]?.id;
  if (!sid) return layout;
  return patchScreenChromeElements(layout, sid, updater);
}

export function patchScreenOrChromeElements(
  layout: HubLayout,
  surfaceId: string,
  updater: (elements: HubElement[]) => HubElement[]
): HubLayout {
  const ownerId = resolveChromeOwnerScreenId(layout, surfaceId);
  if (ownerId) {
    return patchScreenChromeElements(layout, ownerId, updater);
  }
  return {
    ...layout,
    updatedAt: new Date().toISOString(),
    screens: layout.screens.map((s) =>
      s.id === surfaceId ? { ...s, elements: updater(s.elements) } : s
    ),
  };
}

export function patchScreenChromeMeta(
  layout: HubLayout,
  screenId: string,
  patch: Partial<Pick<LauncherChromeLayout, "height" | "backgroundColor" | "width">>
): HubLayout {
  return {
    ...layout,
    updatedAt: new Date().toISOString(),
    screens: layout.screens.map((s) => {
      if (s.id !== screenId) return s;
      const chrome = ensureScreenChrome(s, layout);
      const w = patch.width ?? chrome.width ?? resolveLauncherChromeWidth(layout);
      const h = patch.height ?? chrome.height ?? DEFAULT_LAUNCHER_CHROME_HEIGHT;
      let elements = chrome.elements;
      if (patch.height !== undefined) {
        elements = fitScreenElementsToBounds(elements, w, h);
      }
      return {
        ...s,
        chrome: {
          ...chrome,
          width: w,
          height: h,
          backgroundColor: patch.backgroundColor ?? chrome.backgroundColor,
          elements,
        },
      };
    }),
  };
}
