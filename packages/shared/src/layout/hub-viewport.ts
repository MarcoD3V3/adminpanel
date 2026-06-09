import type { HubElement, HubLayout, HubScreen } from "../types/hub-layout";

/** Altura por defecto de la barra superior del launcher. */
export const LAUNCHER_CHROME_HEIGHT = 40;

/** Altura de la barra superior de una ventana (personalizada o por defecto). */
export function resolveLayoutChromeHeight(layout: HubLayout, screenId?: string): number {
  const sid = screenId ?? layout.activeScreenId;
  const screen = layout.screens.find((s) => s.id === sid);
  const h = screen?.chrome?.height ?? layout.launcherChrome?.height;
  if (typeof h === "number" && Number.isFinite(h) && h > 0) {
    return Math.round(h);
  }
  return LAUNCHER_CHROME_HEIGHT;
}

export const MIN_ELEMENT_WIDTH = 24;
export const MIN_ELEMENT_HEIGHT = 16;

export type HubViewport = {
  frameWidth: number;
  frameHeight: number;
  contentWidth: number;
  contentHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  chromeHeight: number;
  usesFixedWindow: boolean;
};

export function clampElement(
  x: number,
  y: number,
  width: number,
  height: number,
  canvasW: number,
  canvasH: number
) {
  const maxX = Math.max(0, canvasW - width);
  const maxY = Math.max(0, canvasH - height);
  return {
    x: Math.min(Math.max(0, x), maxX),
    y: Math.min(Math.max(0, y), maxY),
  };
}

export function fitScreenElementsToBounds(
  elements: HubElement[],
  canvasW: number,
  canvasH: number
): HubElement[] {
  if (!elements.length) return elements;

  const byId = new Map(elements.map((e) => [e.id, e]));
  const depth = (el: HubElement): number => {
    let d = 0;
    let pid = el.parentId;
    while (pid && d < 32) {
      d += 1;
      pid = byId.get(pid)?.parentId;
    }
    return d;
  };

  const fitted = new Map<string, HubElement>();
  const sorted = [...elements].sort((a, b) => depth(a) - depth(b));

  for (const el of sorted) {
    let boundsW = canvasW;
    let boundsH = canvasH;

    if (el.parentId) {
      const parent = fitted.get(el.parentId) ?? byId.get(el.parentId);
      if (parent) {
        const parentDisplay = parent.container?.display ?? "absolute";
        const pad =
          parentDisplay === "absolute" ? 0 : Math.max(0, Number(parent.container?.padding ?? 0));
        boundsW = Math.max(MIN_ELEMENT_WIDTH, parent.width - pad * 2);
        boundsH = Math.max(MIN_ELEMENT_HEIGHT, parent.height - pad * 2);
      }
    }

    const width = Math.min(Math.max(MIN_ELEMENT_WIDTH, el.width), Math.max(MIN_ELEMENT_WIDTH, boundsW));
    const height = Math.min(
      Math.max(MIN_ELEMENT_HEIGHT, el.height),
      Math.max(MIN_ELEMENT_HEIGHT, boundsH)
    );
    const { x, y } = clampElement(el.x, el.y, width, height, boundsW, boundsH);

    fitted.set(el.id, { ...el, x, y, width, height });
  }

  return elements.map((el) => fitted.get(el.id) ?? el);
}

/** Área de diseño según ventana fija del layout o tamaño de pantalla. */
export function resolveHubViewport(
  layout: HubLayout,
  screen: HubScreen,
  options?: { elements?: HubElement[]; contentChromeHeight?: number }
): HubViewport {
  const chromeHeight = options?.contentChromeHeight ?? resolveLayoutChromeHeight(layout);
  const elements = options?.elements ?? screen.elements;
  const scrollMode = Boolean(screen.scroll);
  const independentCanvas = Boolean(screen.independentCanvas);

  const ww = layout.window?.width;
  const wh = layout.window?.height;
  const hasW = typeof ww === "number" && Number.isFinite(ww) && ww > 0;
  const hasH = typeof wh === "number" && Number.isFinite(wh) && wh > 0;
  const usesFixedWindow = !independentCanvas && (hasW || hasH);

  const contentScrollHeight = scrollMode
    ? Math.max(screen.height, ...elements.map((el) => el.y + el.height + 48))
    : screen.height;

  if (usesFixedWindow) {
    const frameWidth = hasW ? Math.max(320, Math.round(ww)) : screen.width;
    const frameHeight = hasH
      ? Math.max(120, Math.round(wh))
      : (scrollMode ? contentScrollHeight : screen.height) + chromeHeight;
    const contentWidth = frameWidth;
    const contentHeight = hasH
      ? Math.max(80, frameHeight - chromeHeight)
      : scrollMode
        ? contentScrollHeight
        : screen.height;
    return {
      frameWidth,
      frameHeight,
      contentWidth,
      contentHeight,
      canvasWidth: contentWidth,
      canvasHeight: hasH ? contentHeight : scrollMode ? contentScrollHeight : screen.height,
      chromeHeight,
      usesFixedWindow: true,
    };
  }

  const frameWidth = screen.width;
  const frameHeight = (scrollMode ? contentScrollHeight : screen.height) + chromeHeight;

  return {
    frameWidth,
    frameHeight,
    contentWidth: screen.width,
    contentHeight: scrollMode ? contentScrollHeight : screen.height,
    canvasWidth: screen.width,
    canvasHeight: scrollMode ? contentScrollHeight : screen.height,
    chromeHeight,
    usesFixedWindow: false,
  };
}

export function fixedWindowContentSize(
  width: number,
  height: number,
  chromeHeight: number = LAUNCHER_CHROME_HEIGHT
) {
  const ch = Math.max(0, Math.round(chromeHeight));
  return {
    width: Math.max(320, Math.round(width)),
    height: Math.max(80, Math.round(height) - ch),
  };
}

/** Alinea `layout.window` con todas las pantallas (área = ventana − barra superior). */
export function coerceLayoutWindowConsistency(layout: HubLayout): HubLayout {
  const chromeH = resolveLayoutChromeHeight(layout);
  const ww = layout.window?.width;
  const wh = layout.window?.height;
  const hasW = typeof ww === "number" && Number.isFinite(ww) && ww > 0;
  const hasH = typeof wh === "number" && Number.isFinite(wh) && wh > 0;

  if (hasW && hasH) {
    const { width: contentW, height: contentH } = fixedWindowContentSize(ww, wh, chromeH);
    const screens = layout.screens.map((s) => {
      if (s.independentCanvas) return s;
      return {
        ...s,
        width: contentW,
        height: contentH,
        elements:
          s.elements.length > 0
            ? fitScreenElementsToBounds(s.elements, contentW, contentH)
            : s.elements,
      };
    });
    return { ...layout, screens };
  }

  const active = layout.screens.find((s) => s.id === layout.activeScreenId) ?? layout.screens[0];
  if (!active) return layout;

  const inferredW = hasW ? Math.round(ww) : Math.max(320, active.width);
  const inferredH = hasH ? Math.round(wh) : Math.max(200, active.height + chromeH);

  return coerceLayoutWindowConsistency({
    ...layout,
    window: {
      ...layout.window,
      width: inferredW,
      height: inferredH,
    },
  });
}
