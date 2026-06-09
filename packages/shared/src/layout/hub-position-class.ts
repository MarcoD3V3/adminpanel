import { HUB_UI_CONSTANT_KEYS } from "./hub-element-ui";
import type { HubElement, HubElementStyle, HubLayout } from "../types/hub-layout";

export type PositionClassGeometry = Pick<HubElement, "x" | "y" | "width" | "height" | "zIndex">;

/** Campos compartidos por clase entre ventanas (geometría + apariencia). */
export type PositionClassSyncPayload = Partial<PositionClassGeometry> & {
  style?: HubElementStyle;
  css?: HubElement["css"];
  visible?: boolean;
  locked?: boolean;
  logicConstants?: Record<string, string | number | boolean>;
};

/** Barra superior (chrome) o área de contenido de las ventanas. */
export type PositionClassSurfaceKind = "chrome" | "content";

export type PositionClassPeer = {
  screenId: string;
  screenName: string;
  element: HubElement;
};

function walkElements(layout: HubLayout): HubElement[] {
  const out: HubElement[] = [];
  for (const screen of layout.screens) {
    out.push(...screen.elements);
    out.push(...(screen.chrome?.elements ?? []));
  }
  out.push(...(layout.launcherChrome?.elements ?? []));
  return out;
}

function screenName(layout: HubLayout, screenId: string): string {
  return layout.screens.find((s) => s.id === screenId)?.name ?? screenId;
}

/** Normaliza nombre de clase de posición (vacío → sin clase). */
export function normalizePositionClass(input: string): string | undefined {
  const g = input.trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_.-]/g, "");
  return g || undefined;
}

export function positionClassSurfaceLabel(surface: PositionClassSurfaceKind): string {
  return surface === "chrome" ? "barra superior" : "ventanas de contenido";
}

export function findHubElementById(
  layout: HubLayout,
  id: string,
  preferredScreenId?: string
): HubElement | null {
  if (preferredScreenId) {
    const screen = layout.screens.find((s) => s.id === preferredScreenId);
    if (screen) {
      const chromeHit = screen.chrome?.elements?.find((e) => e.id === id);
      if (chromeHit) return chromeHit;
      const contentHit = screen.elements.find((e) => e.id === id);
      if (contentHit) return contentHit;
    }
  }

  for (const screen of layout.screens) {
    const chromeHit = screen.chrome?.elements?.find((e) => e.id === id);
    if (chromeHit) return chromeHit;
    const hit = screen.elements.find((e) => e.id === id);
    if (hit) return hit;
  }
  return layout.launcherChrome?.elements?.find((e) => e.id === id) ?? null;
}

/** Dónde vive el elemento: chrome o contenido (respeta la ventana activa si el id se repite). */
export function resolvePositionClassSurface(
  layout: HubLayout,
  elementId: string,
  preferredScreenId?: string
): PositionClassSurfaceKind | null {
  if (preferredScreenId) {
    const screen = layout.screens.find((s) => s.id === preferredScreenId);
    if (screen?.chrome?.elements?.some((e) => e.id === elementId)) return "chrome";
    if (screen?.elements.some((e) => e.id === elementId)) return "content";
  }

  for (const screen of layout.screens) {
    if (screen.chrome?.elements?.some((e) => e.id === elementId)) return "chrome";
    if (screen.elements.some((e) => e.id === elementId)) return "content";
  }
  if (layout.launcherChrome?.elements?.some((e) => e.id === elementId)) return "chrome";
  return null;
}

export function resolveElementScreenId(
  layout: HubLayout,
  elementId: string,
  preferredScreenId?: string
): string | null {
  if (preferredScreenId) {
    const screen = layout.screens.find((s) => s.id === preferredScreenId);
    if (screen?.chrome?.elements?.some((e) => e.id === elementId)) return preferredScreenId;
    if (screen?.elements.some((e) => e.id === elementId)) return preferredScreenId;
  }

  for (const screen of layout.screens) {
    if (screen.chrome?.elements?.some((e) => e.id === elementId)) return screen.id;
    if (screen.elements.some((e) => e.id === elementId)) return screen.id;
  }
  return layout.launcherChrome?.elements?.some((e) => e.id === elementId)
    ? layout.activeScreenId ?? layout.screens[0]?.id ?? null
    : null;
}

export function findElementsByPositionClass(layout: HubLayout, positionClass: string): HubElement[] {
  const cls = normalizePositionClass(positionClass);
  if (!cls) return [];
  return walkElements(layout).filter((e) => normalizePositionClass(e.positionClass ?? "") === cls);
}

/** Todos los pares con la misma clase en una superficie, con ventana de origen. */
export function listPositionClassPeers(
  layout: HubLayout,
  positionClass: string,
  surface: PositionClassSurfaceKind,
  options?: { excludeScreenId?: string; excludeElementId?: string }
): PositionClassPeer[] {
  const cls = normalizePositionClass(positionClass);
  if (!cls) return [];

  const peers: PositionClassPeer[] = [];

  for (const screen of layout.screens) {
    const pool =
      surface === "chrome" ? (screen.chrome?.elements ?? []) : screen.elements;
    for (const element of pool) {
      if (normalizePositionClass(element.positionClass ?? "") !== cls) continue;
      if (
        options?.excludeScreenId === screen.id &&
        options.excludeElementId === element.id
      ) {
        continue;
      }
      peers.push({
        screenId: screen.id,
        screenName: screen.name,
        element,
      });
    }
  }

  if (surface === "chrome" && layout.launcherChrome?.elements) {
    const sid = layout.activeScreenId ?? layout.screens[0]?.id ?? "launcher";
    for (const element of layout.launcherChrome.elements) {
      if (normalizePositionClass(element.positionClass ?? "") !== cls) continue;
      if (options?.excludeScreenId === sid && options.excludeElementId === element.id) continue;
      peers.push({
        screenId: sid,
        screenName: screenName(layout, sid),
        element,
      });
    }
  }

  return peers.sort((a, b) => a.screenName.localeCompare(b.screenName));
}

export function findElementsByPositionClassOnSurface(
  layout: HubLayout,
  positionClass: string,
  surface: PositionClassSurfaceKind
): HubElement[] {
  return listPositionClassPeers(layout, positionClass, surface).map((p) => p.element);
}

/** La barra superior reutiliza el mismo id en varias ventanas: propagar clase/metadatos compartidos. */
export function patchChromeElementsById(
  layout: HubLayout,
  elementId: string,
  patch: Partial<HubElement>
): HubLayout {
  if (!elementId || Object.keys(patch).length === 0) return layout;

  const apply = (elements: HubElement[]) =>
    elements.map((el) => (el.id === elementId ? { ...el, ...patch } : el));

  return {
    ...layout,
    updatedAt: new Date().toISOString(),
    screens: layout.screens.map((s) => ({
      ...s,
      chrome: s.chrome
        ? { ...s.chrome, elements: apply(s.chrome.elements) }
        : s.chrome,
    })),
    launcherChrome: layout.launcherChrome
      ? { ...layout.launcherChrome, elements: apply(layout.launcherChrome.elements) }
      : layout.launcherChrome,
  };
}

function appearanceConstantsFromElement(
  el: HubElement
): Record<string, string | number | boolean> | undefined {
  const constants = el.logic?.constants;
  if (!constants) return undefined;
  const out: Record<string, string | number | boolean> = {};
  let any = false;
  for (const key of Object.values(HUB_UI_CONSTANT_KEYS)) {
    if (key in constants) {
      out[key] = constants[key];
      any = true;
    }
  }
  return any ? out : undefined;
}

function applyPositionClassSyncPayload(
  el: HubElement,
  payload: Partial<PositionClassSyncPayload>
): HubElement {
  if (Object.keys(payload).length === 0) return el;

  let next: HubElement = { ...el };

  if (payload.x !== undefined) next.x = payload.x;
  if (payload.y !== undefined) next.y = payload.y;
  if (payload.width !== undefined) next.width = payload.width;
  if (payload.height !== undefined) next.height = payload.height;
  if (payload.zIndex !== undefined) next.zIndex = payload.zIndex;
  if (payload.visible !== undefined) next.visible = payload.visible;
  if (payload.locked !== undefined) next.locked = payload.locked;
  if (payload.style !== undefined) next.style = { ...payload.style };
  if (payload.css !== undefined) next.css = payload.css ? { ...payload.css } : undefined;

  if (payload.logicConstants !== undefined) {
    next = {
      ...next,
      logic: {
        enabled: el.logic?.enabled ?? false,
        trigger: el.logic?.trigger ?? "click",
        script: el.logic?.script ?? "",
        ...el.logic,
        constants: {
          ...(el.logic?.constants ?? {}),
          ...payload.logicConstants,
        },
      },
    };
  }

  return next;
}

function mapMatchingOnSurface(
  elements: HubElement[],
  positionClass: string,
  surface: PositionClassSurfaceKind,
  targetSurface: PositionClassSurfaceKind,
  payload: Partial<PositionClassSyncPayload>
): HubElement[] {
  if (surface !== targetSurface) return elements;
  const cls = normalizePositionClass(positionClass);
  if (!cls) return elements;
  return elements.map((el) =>
    normalizePositionClass(el.positionClass ?? "") === cls
      ? applyPositionClassSyncPayload(el, payload)
      : el
  );
}

/**
 * Copia geometría y apariencia a todos los elementos con la misma clase en la misma superficie
 * (barra superior en todas las ventanas, o contenido en todas las ventanas).
 */
export function syncLayoutByPositionClass(
  layout: HubLayout,
  positionClass: string,
  payload: Partial<PositionClassSyncPayload>,
  surface: PositionClassSurfaceKind
): HubLayout {
  const cls = normalizePositionClass(positionClass);
  if (!cls || Object.keys(payload).length === 0) return layout;

  return {
    ...layout,
    updatedAt: new Date().toISOString(),
    screens: layout.screens.map((s) => ({
      ...s,
      elements: mapMatchingOnSurface(s.elements, cls, "content", surface, payload),
      chrome: s.chrome
        ? {
            ...s.chrome,
            elements: mapMatchingOnSurface(s.chrome.elements, cls, "chrome", surface, payload),
          }
        : s.chrome,
    })),
    launcherChrome:
      surface === "chrome" && layout.launcherChrome
        ? {
            ...layout.launcherChrome,
            elements: mapMatchingOnSurface(
              layout.launcherChrome.elements,
              cls,
              "chrome",
              "chrome",
              payload
            ),
          }
        : layout.launcherChrome,
  };
}

export function geometryFromElement(el: HubElement): PositionClassGeometry {
  return {
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
    zIndex: el.zIndex,
  };
}

/** Puntuación de “cuánto está configurado” un elemento (para elegir líder al unirse a una clase). */
export function scorePositionClassLeader(el: HubElement): number {
  let score = 0;
  const style = el.style ?? {};
  if (style.backgroundColor?.trim()) score += 3;
  if (style.textColor?.trim()) score += 2;
  if (style.fontSize != null && style.fontSize !== 13) score += 1;
  if (style.borderRadius != null && style.borderRadius !== 10) score += 1;
  if (style.fontWeight && style.fontWeight !== "normal") score += 1;
  if (style.contentAlignX && style.contentAlignX !== "center") score += 1;
  if (style.contentAlignY && style.contentAlignY !== "center") score += 1;
  if (el.css && Object.keys(el.css).length > 0) score += 5 + Object.keys(el.css).length;
  const constants = appearanceConstantsFromElement(el);
  if (constants) score += Object.keys(constants).length * 2;
  if (el.imageUrl?.trim()) score += 2;
  return score;
}

/** El peer con más apariencia definida (no el primero alfabéticamente). */
export function pickPositionClassLeader(peers: PositionClassPeer[]): HubElement | null {
  if (peers.length === 0) return null;
  let best = peers[0].element;
  let bestScore = scorePositionClassLeader(best);
  for (let i = 1; i < peers.length; i++) {
    const candidate = peers[i].element;
    const s = scorePositionClassLeader(candidate);
    if (s > bestScore) {
      best = candidate;
      bestScore = s;
    }
  }
  return best;
}

/** Aplica props compartidas sobre un elemento (recibir al unirse a una clase). */
export function applySharedPropsToElement(
  el: HubElement,
  shared: PositionClassSyncPayload
): HubElement {
  let next: HubElement = {
    ...el,
    x: shared.x ?? el.x,
    y: shared.y ?? el.y,
    width: shared.width ?? el.width,
    height: shared.height ?? el.height,
    zIndex: shared.zIndex ?? el.zIndex,
    visible: shared.visible ?? el.visible,
    locked: shared.locked ?? el.locked,
    style: shared.style ? { ...shared.style } : { ...el.style },
    css: shared.css !== undefined ? (shared.css ? { ...shared.css } : undefined) : el.css,
  };
  if (shared.logicConstants) {
    next = {
      ...next,
      logic: {
        enabled: el.logic?.enabled ?? false,
        trigger: el.logic?.trigger ?? "click",
        script: el.logic?.script ?? "",
        ...el.logic,
        constants: {
          ...(el.logic?.constants ?? {}),
          ...shared.logicConstants,
        },
      },
    };
  }
  return next;
}

/** Geometría, estilos, CSS y constantes de UI para sincronizar por clase. */
export function sharedPropsFromElement(el: HubElement): PositionClassSyncPayload {
  const logicConstants = appearanceConstantsFromElement(el);
  return {
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
    zIndex: el.zIndex,
    style: { ...el.style },
    css: el.css ? { ...el.css } : undefined,
    visible: el.visible,
    locked: el.locked,
    ...(logicConstants ? { logicConstants } : {}),
  };
}

export function countChromeCopiesById(layout: HubLayout, elementId: string): number {
  let n = 0;
  for (const screen of layout.screens) {
    if (screen.chrome?.elements?.some((e) => e.id === elementId)) n += 1;
  }
  if (layout.launcherChrome?.elements?.some((e) => e.id === elementId)) n += 1;
  return n;
}

function chromeRoleMatch(source: HubElement, candidate: HubElement): boolean {
  if (source.type !== candidate.type) return false;
  if (source.action && candidate.action && source.action === candidate.action) return true;
  const sourceLabel = source.label?.trim();
  const candidateLabel = candidate.label?.trim();
  if (sourceLabel && candidateLabel && sourceLabel === candidateLabel) return true;
  return false;
}

/** Misma acción/etiqueta en la barra (p. ej. todos los botones − de minimizar). */
export function patchChromeElementsByRole(
  layout: HubLayout,
  source: HubElement,
  patch: Partial<HubElement>
): HubLayout {
  if (Object.keys(patch).length === 0) return layout;

  const apply = (elements: HubElement[]) =>
    elements.map((el) => (chromeRoleMatch(source, el) ? { ...el, ...patch } : el));

  return {
    ...layout,
    updatedAt: new Date().toISOString(),
    screens: layout.screens.map((s) => ({
      ...s,
      chrome: s.chrome ? { ...s.chrome, elements: apply(s.chrome.elements) } : s.chrome,
    })),
    launcherChrome: layout.launcherChrome
      ? { ...layout.launcherChrome, elements: apply(layout.launcherChrome.elements) }
      : layout.launcherChrome,
  };
}
