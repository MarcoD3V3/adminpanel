import type { CSSProperties } from "react";

export type HubEditorCanvasBackgroundType = "solid" | "gradient" | "image" | "pattern";

export type HubEditorCanvasGradientDirection =
  | "horizontal"
  | "vertical"
  | "diagonal"
  | "diagonal-reverse"
  | "radial";

export type HubEditorCanvasImageFit = "cover" | "contain" | "repeat" | "stretch";

export type HubEditorCanvasPatternType = "none" | "dots" | "grid" | "lines";

export type HubEditorVisualGridStyle = "dots" | "lines" | "cross";

export type HubEditorCanvasSettings = {
  backgroundType: HubEditorCanvasBackgroundType;
  solidColor: string;
  gradientFrom: string;
  gradientTo: string;
  gradientDirection: HubEditorCanvasGradientDirection;
  imageUrl: string;
  imageFit: HubEditorCanvasImageFit;
  imageOpacity: number;
  patternType: HubEditorCanvasPatternType;
  patternColor: string;
  patternSize: number;
  patternOpacity: number;
  /** Paso de snap al mover/redimensionar en pantallas (px). */
  snapGridSize: number;
  /** Paso de snap en la barra superior (px). */
  snapChromeGridSize: number;
  /** Separación entre marcas visuales de la cuadrícula (px). Independiente del snap. */
  visualGridStep: number;
  /** Tamaño del punto visual (px). */
  visualGridDotSize: number;
  /** Grosor de líneas visuales (px). */
  visualGridLineWidth: number;
  visualGridStyle: HubEditorVisualGridStyle;
  visualGridColor: string;
  visualGridOpacity: number;
  visualGridOffsetX: number;
  visualGridOffsetY: number;
};

export const HUB_EDITOR_CANVAS_SETTINGS_KEY = "hub-builder-editor-canvas-settings";

export const DEFAULT_HUB_EDITOR_CANVAS_SETTINGS: HubEditorCanvasSettings = {
  backgroundType: "solid",
  solidColor: "#0a0c0f",
  gradientFrom: "#0a0c0f",
  gradientTo: "#151a22",
  gradientDirection: "diagonal",
  imageUrl: "",
  imageFit: "cover",
  imageOpacity: 100,
  patternType: "none",
  patternColor: "rgba(255,255,255,0.07)",
  patternSize: 20,
  patternOpacity: 80,
  snapGridSize: 4,
  snapChromeGridSize: 2,
  visualGridStep: 8,
  visualGridDotSize: 1,
  visualGridLineWidth: 1,
  visualGridStyle: "dots",
  visualGridColor: "rgba(255,255,255,0.09)",
  visualGridOpacity: 100,
  visualGridOffsetX: 0,
  visualGridOffsetY: 0,
};

const GRADIENT_DIRECTION_CSS: Record<HubEditorCanvasGradientDirection, string> = {
  horizontal: "90deg",
  vertical: "180deg",
  diagonal: "135deg",
  "diagonal-reverse": "45deg",
  radial: "circle at center",
};

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 100;
  return Math.min(100, Math.max(0, n));
}

function clampPatternSize(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_HUB_EDITOR_CANVAS_SETTINGS.patternSize;
  return Math.min(64, Math.max(8, Math.round(n)));
}

function clampSnapGrid(n: number, fallback: number, max = 64): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(1, Math.round(n)));
}

function clampVisualStep(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_HUB_EDITOR_CANVAS_SETTINGS.visualGridStep;
  return Math.min(128, Math.max(4, Math.round(n)));
}

function clampVisualDot(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_HUB_EDITOR_CANVAS_SETTINGS.visualGridDotSize;
  return Math.min(8, Math.max(0.5, Math.round(n * 2) / 2));
}

function clampVisualLineWidth(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_HUB_EDITOR_CANVAS_SETTINGS.visualGridLineWidth;
  return Math.min(4, Math.max(0.5, Math.round(n * 2) / 2));
}

function clampOffset(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(64, Math.max(-64, Math.round(n)));
}

function normalizeSettings(raw: Partial<HubEditorCanvasSettings> | null | undefined): HubEditorCanvasSettings {
  const base = DEFAULT_HUB_EDITOR_CANVAS_SETTINGS;
  if (!raw || typeof raw !== "object") return { ...base };

  const backgroundType =
    raw.backgroundType === "gradient" ||
    raw.backgroundType === "image" ||
    raw.backgroundType === "pattern" ||
    raw.backgroundType === "solid"
      ? raw.backgroundType
      : base.backgroundType;

  const gradientDirection =
    raw.gradientDirection === "horizontal" ||
    raw.gradientDirection === "vertical" ||
    raw.gradientDirection === "diagonal" ||
    raw.gradientDirection === "diagonal-reverse" ||
    raw.gradientDirection === "radial"
      ? raw.gradientDirection
      : base.gradientDirection;

  const imageFit =
    raw.imageFit === "cover" ||
    raw.imageFit === "contain" ||
    raw.imageFit === "repeat" ||
    raw.imageFit === "stretch"
      ? raw.imageFit
      : base.imageFit;

  const patternType =
    raw.patternType === "dots" ||
    raw.patternType === "grid" ||
    raw.patternType === "lines" ||
    raw.patternType === "none"
      ? raw.patternType
      : base.patternType;

  const visualGridStyle =
    raw.visualGridStyle === "dots" ||
    raw.visualGridStyle === "lines" ||
    raw.visualGridStyle === "cross"
      ? raw.visualGridStyle
      : base.visualGridStyle;

  return {
    backgroundType,
    solidColor: typeof raw.solidColor === "string" && raw.solidColor.trim() ? raw.solidColor.trim() : base.solidColor,
    gradientFrom:
      typeof raw.gradientFrom === "string" && raw.gradientFrom.trim() ? raw.gradientFrom.trim() : base.gradientFrom,
    gradientTo: typeof raw.gradientTo === "string" && raw.gradientTo.trim() ? raw.gradientTo.trim() : base.gradientTo,
    gradientDirection,
    imageUrl: typeof raw.imageUrl === "string" ? raw.imageUrl.trim() : base.imageUrl,
    imageFit,
    imageOpacity: clampPct(Number(raw.imageOpacity ?? base.imageOpacity)),
    patternType,
    patternColor:
      typeof raw.patternColor === "string" && raw.patternColor.trim() ? raw.patternColor.trim() : base.patternColor,
    patternSize: clampPatternSize(Number(raw.patternSize ?? base.patternSize)),
    patternOpacity: clampPct(Number(raw.patternOpacity ?? base.patternOpacity)),
    snapGridSize: clampSnapGrid(Number(raw.snapGridSize ?? base.snapGridSize), base.snapGridSize),
    snapChromeGridSize: clampSnapGrid(
      Number(raw.snapChromeGridSize ?? base.snapChromeGridSize),
      base.snapChromeGridSize,
      32
    ),
    visualGridStep: clampVisualStep(Number(raw.visualGridStep ?? base.visualGridStep)),
    visualGridDotSize: clampVisualDot(Number(raw.visualGridDotSize ?? base.visualGridDotSize)),
    visualGridLineWidth: clampVisualLineWidth(Number(raw.visualGridLineWidth ?? base.visualGridLineWidth)),
    visualGridStyle,
    visualGridColor:
      typeof raw.visualGridColor === "string" && raw.visualGridColor.trim()
        ? raw.visualGridColor.trim()
        : base.visualGridColor,
    visualGridOpacity: clampPct(Number(raw.visualGridOpacity ?? base.visualGridOpacity)),
    visualGridOffsetX: clampOffset(Number(raw.visualGridOffsetX ?? base.visualGridOffsetX)),
    visualGridOffsetY: clampOffset(Number(raw.visualGridOffsetY ?? base.visualGridOffsetY)),
  };
}

export function readHubEditorCanvasSettings(): HubEditorCanvasSettings {
  if (typeof window === "undefined") return { ...DEFAULT_HUB_EDITOR_CANVAS_SETTINGS };
  try {
    const raw = window.localStorage.getItem(HUB_EDITOR_CANVAS_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_HUB_EDITOR_CANVAS_SETTINGS };
    return normalizeSettings(JSON.parse(raw) as Partial<HubEditorCanvasSettings>);
  } catch {
    return { ...DEFAULT_HUB_EDITOR_CANVAS_SETTINGS };
  }
}

export function writeHubEditorCanvasSettings(settings: HubEditorCanvasSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HUB_EDITOR_CANVAS_SETTINGS_KEY, JSON.stringify(settings));
}

function applyOpacityToColor(color: string, opacityPct: number): string {
  const alpha = clampPct(opacityPct) / 100;
  if (alpha >= 1) return color;
  const hex = color.trim();
  const hexMatch = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (hexMatch) {
    const raw = hexMatch[1]!;
    const full =
      raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const rgbaMatch = /^rgba?\(([^)]+)\)$/i.exec(color.trim());
  if (rgbaMatch) {
    const parts = rgbaMatch[1]!.split(",").map((p) => p.trim());
    if (parts.length >= 3) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
    }
  }
  return color;
}

function buildPatternLayer(settings: HubEditorCanvasSettings): string | null {
  if (settings.patternType === "none" || settings.patternOpacity <= 0) return null;

  const size = clampPatternSize(settings.patternSize);
  const color = applyOpacityToColor(settings.patternColor, settings.patternOpacity);

  if (settings.patternType === "dots") {
    return `radial-gradient(circle, ${color} 0.8px, transparent 0.8px)`;
  }

  if (settings.patternType === "grid") {
    return `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`;
  }

  return `repeating-linear-gradient(135deg, ${color} 0, ${color} 1px, transparent 1px, transparent ${size}px)`;
}

function patternLayerSize(settings: HubEditorCanvasSettings): string | undefined {
  const size = clampPatternSize(settings.patternSize);
  if (settings.patternType === "dots") return `${size}px ${size}px`;
  if (settings.patternType === "grid") return `${size}px ${size}px`;
  return undefined;
}

export function resolveHubEditorCanvasStyle(settings: HubEditorCanvasSettings): CSSProperties {
  const normalized = normalizeSettings(settings);
  const layers: string[] = [];
  const sizes: string[] = [];
  const style: CSSProperties = {
    backgroundColor: normalized.solidColor,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center",
  };

  const pattern = buildPatternLayer(normalized);
  if (pattern) {
    layers.push(pattern);
    const patternSize = patternLayerSize(normalized);
    if (patternSize) sizes.push(patternSize);
  }

  if (normalized.backgroundType === "gradient") {
    const dir = GRADIENT_DIRECTION_CSS[normalized.gradientDirection];
    const gradient =
      normalized.gradientDirection === "radial"
        ? `radial-gradient(${dir}, ${normalized.gradientFrom}, ${normalized.gradientTo})`
        : `linear-gradient(${dir}, ${normalized.gradientFrom}, ${normalized.gradientTo})`;
    layers.push(gradient);
    sizes.push("auto");
  } else if (normalized.backgroundType === "image" && normalized.imageUrl) {
    const opacity = clampPct(normalized.imageOpacity) / 100;
    const safeUrl = normalized.imageUrl.replace(/"/g, '\\"');
    const imageLayer =
      opacity < 1
        ? `linear-gradient(${applyOpacityToColor(normalized.solidColor, opacity * 100)}, ${applyOpacityToColor(normalized.solidColor, opacity * 100)}), url("${safeUrl}")`
        : `url("${safeUrl}")`;
    layers.push(imageLayer);
    if (normalized.imageFit === "repeat") {
      style.backgroundRepeat = "repeat";
      sizes.push("auto");
    } else if (normalized.imageFit === "stretch") {
      sizes.push("100% 100%");
    } else {
      sizes.push(normalized.imageFit);
    }
  } else if (normalized.backgroundType === "pattern" && !pattern) {
    style.backgroundColor = normalized.solidColor;
  }

  if (layers.length > 0) {
    style.backgroundImage = layers.join(", ");
    if (sizes.length > 0) style.backgroundSize = sizes.join(", ");
  }

  return style;
}

export function patchHubEditorCanvasSettings(
  current: HubEditorCanvasSettings,
  patch: Partial<HubEditorCanvasSettings>
): HubEditorCanvasSettings {
  return normalizeSettings({ ...current, ...patch });
}

export function resolveEditorSnapGridSize(
  editTarget: "screen" | "launcher-chrome",
  settings: HubEditorCanvasSettings
): number {
  const normalized = normalizeSettings(settings);
  return editTarget === "launcher-chrome" ? normalized.snapChromeGridSize : normalized.snapGridSize;
}

export function resolveHubCanvasGridOverlayStyle(
  settings: HubEditorCanvasSettings,
  isChrome: boolean
): CSSProperties {
  const s = normalizeSettings(settings);
  const step = s.visualGridStep;
  const dot = s.visualGridDotSize;
  const lineW = s.visualGridLineWidth;
  const color = applyOpacityToColor(
    isChrome ? "rgba(107, 158, 120, 0.35)" : s.visualGridColor,
    s.visualGridOpacity
  );
  const size = `${step}px ${step}px`;
  const pos = `${s.visualGridOffsetX}px ${s.visualGridOffsetY}px`;

  if (s.visualGridStyle === "cross") {
    return {
      backgroundImage: `linear-gradient(${color} ${lineW}px, transparent ${lineW}px), linear-gradient(90deg, ${color} ${lineW}px, transparent ${lineW}px)`,
      backgroundSize: size,
      backgroundPosition: pos,
    };
  }

  if (s.visualGridStyle === "lines") {
    return {
      backgroundImage: `repeating-linear-gradient(0deg, ${color}, ${color} ${lineW}px, transparent ${lineW}px, transparent ${step}px)`,
      backgroundSize: "100% 100%",
      backgroundPosition: pos,
    };
  }

  return {
    backgroundImage: `radial-gradient(circle, ${color} ${dot}px, transparent ${dot}px)`,
    backgroundSize: size,
    backgroundPosition: pos,
  };
}
