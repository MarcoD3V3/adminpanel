import type { HubElement } from "../types/hub-layout";
import { HUB_UI_CONSTANT_KEYS } from "./hub-element-ui";

export const HUB_TEXT_STYLE_COUNT = 23;

/** Tipos lógicos/invisibles sin selector de estilo de texto. */
export const HUB_TEXT_STYLE_EXCLUDED_TYPES = new Set<HubElement["type"]>([
  "automation-node",
  "show-on-condition",
  "hide-on-condition",
]);

export const TEXT_STYLE_OPTIONS = [
  { value: "1", label: "Por defecto" },
  { value: "2", label: "Script · Pacifico" },
  { value: "3", label: "Pincel · Kaushan" },
  { value: "4", label: "Marcador" },
  { value: "5", label: "Display · Bebas" },
  { value: "6", label: "Retro · Righteous" },
  { value: "7", label: "Elegante · Cinzel" },
  { value: "8", label: "Futuro · Audiowide" },
  { value: "9", label: "Logo · Lobster" },
  { value: "10", label: "Bloque · Bungee" },
  { value: "11", label: "Sci-fi · Orbitron" },
  { value: "12", label: "MC · Minecrafter 3D" },
  { value: "13", label: "MC · Arcade 8-bit" },
  { value: "14", label: "MC · Terminal CRT" },
  { value: "15", label: "MC · Pixelify Sans" },
  { value: "16", label: "MC · Minecrafter Alt" },
  { value: "17", label: "MC · Medieval" },
  { value: "18", label: "MC · Launcher JUGAR" },
  { value: "19", label: "MC · Menú Silkscreen" },
  { value: "20", label: "MC · Minecraftia" },
  { value: "21", label: "MC · Logo Minecraft" },
  { value: "22", label: "MC · Bloque Sixtyfour" },
  { value: "23", label: "MC · Creeper Glow" },
] as const;

export type HubTextStyleId =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22
  | 23;

export type HubTextStyleCss = {
  fontFamily?: string;
  fontWeight?: string | number;
  textTransform?: string;
  letterSpacing?: string;
  textShadow?: string;
  lineHeight?: string | number;
};

const HUB_TEXT_STYLE_CSS: Record<HubTextStyleId, HubTextStyleCss | null> = {
  1: null,
  2: { fontFamily: '"Pacifico", cursive', fontWeight: 400, letterSpacing: "0.02em", textTransform: "none" },
  3: { fontFamily: '"Kaushan Script", cursive', fontWeight: 400, letterSpacing: "0.01em", textTransform: "none" },
  4: { fontFamily: '"Permanent Marker", cursive', fontWeight: 400, letterSpacing: "0.03em", textTransform: "none" },
  5: {
    fontFamily: '"Bebas Neue", sans-serif',
    fontWeight: 400,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  6: {
    fontFamily: '"Righteous", sans-serif',
    fontWeight: 400,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  7: { fontFamily: '"Cinzel Decorative", serif', fontWeight: 700, letterSpacing: "0.06em", textTransform: "none" },
  8: {
    fontFamily: '"Audiowide", sans-serif',
    fontWeight: 400,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  },
  9: { fontFamily: '"Lobster", cursive', fontWeight: 400, letterSpacing: "0.02em", textTransform: "none" },
  10: {
    fontFamily: '"Bungee", sans-serif',
    fontWeight: 400,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  11: {
    fontFamily: '"Orbitron", sans-serif',
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
  },
  12: {
    fontFamily: '"Minecrafter", "Silkscreen", monospace',
    fontWeight: 400,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    textShadow: "4px 4px 0 #000, 5px 5px 0 rgba(0, 0, 0, 0.45)",
  },
  13: {
    fontFamily: '"Press Start 2P", monospace',
    fontWeight: 400,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    lineHeight: 1.45,
    textShadow: "3px 3px 0 #000",
  },
  14: {
    fontFamily: '"VT323", monospace',
    fontWeight: 400,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    textShadow: "2px 2px 0 #000, 3px 3px 0 #000",
  },
  15: {
    fontFamily: '"Pixelify Sans", monospace',
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    textShadow: "3px 3px 0 #000",
  },
  16: {
    fontFamily: '"Minecrafter Alt", "DotGothic16", monospace',
    fontWeight: 400,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    textShadow: "4px 4px 0 #000",
  },
  17: {
    fontFamily: '"MedievalSharp", "Times New Roman", serif',
    fontWeight: 400,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    textShadow: "2px 2px 0 #000, 3px 3px 0 rgba(0, 0, 0, 0.55)",
  },
  18: {
    fontFamily: '"Montserrat", system-ui, sans-serif',
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    textShadow: "3px 3px 0 #000",
  },
  19: {
    fontFamily: '"Silkscreen", monospace',
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    textShadow: "2px 2px 0 #1a1a1a",
  },
  20: {
    fontFamily: '"Minecraftia", "Silkscreen", monospace',
    fontWeight: 400,
    textTransform: "none",
    letterSpacing: "0.04em",
    textShadow: "3px 3px 0 #000",
  },
  21: {
    fontFamily: '"Minecraft", "Minecrafter", monospace',
    fontWeight: 400,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    textShadow: "4px 4px 0 #000, 5px 5px 0 rgba(0, 0, 0, 0.5)",
  },
  22: {
    fontFamily: '"Sixtyfour", "Press Start 2P", monospace',
    fontWeight: 400,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    lineHeight: 1.4,
    textShadow: "3px 3px 0 #000, 4px 4px 0 #333",
  },
  23: {
    fontFamily: '"Silkscreen", monospace',
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    textShadow:
      "0 0 6px #6bff6b, 0 0 14px #3dcc3d, 0 0 22px rgba(34, 139, 34, 0.55), 3px 3px 0 #0d2b0d",
  },
};

function readConst(constants: Record<string, unknown> | undefined, key: string): string {
  const v = constants?.[key];
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function clampTextStyleId(raw: number): HubTextStyleId {
  if (!Number.isFinite(raw)) return 1;
  return Math.min(HUB_TEXT_STYLE_COUNT, Math.max(1, raw)) as HubTextStyleId;
}

export function resolveTextStyle(element: HubElement): HubTextStyleId {
  const raw = parseInt(readConst(element.logic?.constants, HUB_UI_CONSTANT_KEYS.TEXT_STYLE) || "1", 10);
  return clampTextStyleId(raw);
}

export function hubTextStyleClassName(style: HubTextStyleId | number): string {
  const id = clampTextStyleId(Number(style) || 1);
  return `hub-text-style-${id}`;
}

export function hubElementSupportsTextStyle(elementType: string): boolean {
  return !HUB_TEXT_STYLE_EXCLUDED_TYPES.has(elementType as HubElement["type"]);
}

export function hubTextStyleClassForElement(element: HubElement): string {
  if (!hubElementSupportsTextStyle(element.type)) return "";
  return hubTextStyleClassName(resolveTextStyle(element));
}

/** Tipografía inline: gana sobre presets visuales (p. ej. Minecraft con !important). */
export function hubTextStyleInlineCss(element: HubElement): Record<string, string | number> {
  if (!hubElementSupportsTextStyle(element.type)) return {};
  const preset = HUB_TEXT_STYLE_CSS[resolveTextStyle(element)];
  if (!preset) return {};
  return { ...preset };
}
