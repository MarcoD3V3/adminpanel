import type { CSSProperties } from "react";
import type { HubElement, HubSurfaceBlendMode, HubSurfaceBoxOptions, HubSurfacePreset } from "../types/hub-layout";
import { resolveHubBackgroundColor } from "./hub-element-style";

export type { HubSurfaceBlendMode, HubSurfaceBoxOptions, HubSurfacePreset };

export const HUB_SURFACE_PRESET_OPTIONS: { value: HubSurfacePreset; label: string }[] = [
  { value: "custom", label: "Personalizado" },
  { value: "glass", label: "Cristal (blur)" },
  { value: "frosted", label: "Escarcha" },
  { value: "solid", label: "Sólido" },
  { value: "outline", label: "Solo borde" },
  { value: "elevated", label: "Elevado" },
  { value: "soft", label: "Suave" },
];

export const HUB_SURFACE_BLEND_OPTIONS: { value: HubSurfaceBlendMode; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "screen", label: "Screen" },
  { value: "overlay", label: "Overlay" },
  { value: "soft-light", label: "Soft light" },
  { value: "multiply", label: "Multiply" },
  { value: "lighten", label: "Lighten" },
  { value: "darken", label: "Darken" },
];

export const HUB_SURFACE_BORDER_STYLE_OPTIONS = [
  { value: "none", label: "Sin borde" },
  { value: "solid", label: "Sólido" },
  { value: "dashed", label: "Discontinuo" },
  { value: "dotted", label: "Puntos" },
] as const;

const PRESET_DEFAULTS: Record<Exclude<HubSurfacePreset, "custom">, HubSurfaceBoxOptions> = {
  glass: {
    preset: "glass",
    backdropBlur: 16,
    backdropSaturate: 140,
    backgroundOpacity: 35,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderStyle: "solid",
    clipContent: true,
  },
  frosted: {
    preset: "frosted",
    backdropBlur: 24,
    backdropSaturate: 180,
    backgroundOpacity: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderStyle: "solid",
    clipContent: true,
  },
  solid: {
    preset: "solid",
    backdropBlur: 0,
    backgroundOpacity: 100,
    borderWidth: 0,
    borderStyle: "none",
    shadowBlur: 10,
    shadowY: 3,
    shadowColor: "rgba(0,0,0,0.28)",
    clipContent: true,
  },
  outline: {
    preset: "outline",
    backdropBlur: 0,
    backgroundOpacity: 0,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderStyle: "solid",
    clipContent: true,
  },
  elevated: {
    preset: "elevated",
    backdropBlur: 0,
    backgroundOpacity: 94,
    borderWidth: 0,
    borderStyle: "none",
    shadowBlur: 28,
    shadowY: 10,
    shadowSpread: -6,
    shadowColor: "rgba(0,0,0,0.5)",
    clipContent: true,
  },
  soft: {
    preset: "soft",
    backdropBlur: 8,
    backdropSaturate: 120,
    backgroundOpacity: 58,
    borderWidth: 0,
    borderStyle: "none",
    shadowBlur: 14,
    shadowY: 4,
    shadowColor: "rgba(0,0,0,0.22)",
    clipContent: true,
  },
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function parseHexChannel(hex: string): { r: number; g: number; b: number; a: number } | null {
  const h = hex.replace("#", "");
  if (h.length === 3) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
      a: 1,
    };
  }
  if (h.length === 6) {
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: 1,
    };
  }
  if (h.length === 8) {
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: parseInt(h.slice(6, 8), 16) / 255,
    };
  }
  return null;
}

function parseColorToRgba(color: string): { r: number; g: number; b: number; a: number } | null {
  const c = color.trim();
  if (c === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  if (c.startsWith("#")) return parseHexChannel(c);
  const rgb = c.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (rgb) {
    return {
      r: Number(rgb[1]),
      g: Number(rgb[2]),
      b: Number(rgb[3]),
      a: rgb[4] !== undefined ? Number(rgb[4]) : 1,
    };
  }
  return null;
}

export function applySurfaceBackgroundOpacity(color: string, opacityPercent: number): string {
  const pct = clamp(opacityPercent, 0, 100);
  if (pct >= 100) return color;
  const parsed = parseColorToRgba(color);
  if (!parsed) return color;
  const o = (pct / 100) * parsed.a;
  return `rgba(${Math.round(parsed.r)}, ${Math.round(parsed.g)}, ${Math.round(parsed.b)}, ${o.toFixed(3)})`;
}

export function resolveSurfaceBoxConfig(element: HubElement): HubSurfaceBoxOptions {
  const raw = element.surface ?? {};
  const preset = raw.preset ?? "custom";
  if (preset === "custom") return { ...raw };
  return { ...PRESET_DEFAULTS[preset], ...raw, preset };
}

export function surfaceBoxPresetPatch(preset: HubSurfacePreset): HubSurfaceBoxOptions {
  if (preset === "custom") return { preset: "custom" };
  return { ...PRESET_DEFAULTS[preset] };
}

export function resolveSurfaceBoxShellStyle(
  element: HubElement,
  opts?: { fallbackBg?: string }
): CSSProperties {
  const cfg = resolveSurfaceBoxConfig(element);
  const radius = element.style.borderRadius ?? 10;
  const baseBg = resolveHubBackgroundColor(
    element.style.backgroundColor,
    opts?.fallbackBg ?? "rgba(255,255,255,0.04)"
  );
  const bgOpacity = cfg.backgroundOpacity ?? 100;
  const backgroundColor =
    bgOpacity <= 0 && baseBg !== "transparent"
      ? "transparent"
      : applySurfaceBackgroundOpacity(baseBg, bgOpacity);

  const style: CSSProperties = {
    borderRadius: radius,
    backgroundColor,
    boxSizing: "border-box",
  };

  const blur = Math.max(0, Number(cfg.backdropBlur ?? 0));
  const saturate = Math.max(0, Number(cfg.backdropSaturate ?? 100));
  if (blur > 0 || saturate !== 100) {
    const parts: string[] = [];
    if (blur > 0) parts.push(`blur(${blur}px)`);
    if (saturate !== 100) parts.push(`saturate(${saturate}%)`);
    const filter = parts.join(" ");
    style.backdropFilter = filter;
    (style as Record<string, string>).WebkitBackdropFilter = filter;
  }

  const borderStyle = cfg.borderStyle ?? "solid";
  const borderWidth = Math.max(0, Number(cfg.borderWidth ?? 0));
  if (borderWidth > 0 && borderStyle !== "none") {
    style.border = `${borderWidth}px ${borderStyle} ${resolveHubBackgroundColor(
      cfg.borderColor,
      "rgba(255,255,255,0.12)"
    )}`;
  } else if (borderStyle === "none" || borderWidth === 0) {
    style.border = "none";
  }

  const shadowX = Number(cfg.shadowX ?? 0);
  const shadowY = Number(cfg.shadowY ?? 0);
  const shadowBlur = Math.max(0, Number(cfg.shadowBlur ?? 0));
  const shadowSpread = Number(cfg.shadowSpread ?? 0);
  if (shadowBlur > 0 || shadowSpread !== 0 || shadowX !== 0 || shadowY !== 0) {
    style.boxShadow = `${shadowX}px ${shadowY}px ${shadowBlur}px ${shadowSpread}px ${resolveHubBackgroundColor(
      cfg.shadowColor,
      "rgba(0,0,0,0.35)"
    )}`;
  }

  const blend = cfg.blendMode ?? "normal";
  if (blend !== "normal") {
    style.mixBlendMode = blend;
  }

  if (cfg.clipContent !== false) {
    style.overflow = "hidden";
  }

  return style;
}
