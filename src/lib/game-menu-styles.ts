import type { CSSProperties } from "react";
import type { HubElement, HubElementStyle } from "@/types/hub-builder";
import { lighten } from "@/lib/game-ui-export";

/** Campos de estilo extra para el menú Minecraft (editor + export). */
export type GameMenuStyle = HubElementStyle & {
  borderColor?: string;
  backgroundColorHover?: string;
  opacity?: number;
};

export type GameMenuStylePreset = {
  id: string;
  label: string;
  description: string;
  style: GameMenuStyle;
};

export const GAME_MENU_STYLE_PRESETS: GameMenuStylePreset[] = [
  {
    id: "vanilla",
    label: "Vanilla",
    description: "Plano gris estilo Minecraft",
    style: {
      backgroundColor: "#2b2e33",
      textColor: "#e8eaed",
      borderColor: "#72757a",
      backgroundColorHover: "#3a3e45",
      borderRadius: 0,
      fontSize: 8,
    },
  },
  {
    id: "lunar-pill",
    label: "Lunar píldora",
    description: "Oscuro con bordes redondeados",
    style: {
      backgroundColor: "#1e2126",
      textColor: "#e8eaed",
      borderColor: "#3a3e45",
      backgroundColorHover: "#2b2e33",
      borderRadius: 10,
      fontSize: 9,
    },
  },
  {
    id: "lunar-wide",
    label: "Lunar ancho",
    description: "Botón principal ancho",
    style: {
      backgroundColor: "#16181c",
      textColor: "#ffffff",
      borderColor: "#2b2f36",
      backgroundColorHover: "#1e2126",
      borderRadius: 8,
      fontSize: 9,
      fontWeight: "medium",
    },
  },
  {
    id: "store",
    label: "Tienda",
    description: "Verde acento (Store)",
    style: {
      backgroundColor: "#1a2e1f",
      textColor: "#6b9e78",
      borderColor: "#496f4f",
      backgroundColorHover: "#243828",
      borderRadius: 8,
      fontSize: 9,
      fontWeight: "medium",
    },
  },
  {
    id: "discord",
    label: "Discord",
    description: "Azul Discord",
    style: {
      backgroundColor: "#5865f2",
      textColor: "#ffffff",
      borderColor: "#4752c4",
      backgroundColorHover: "#6b77f5",
      borderRadius: 8,
      fontSize: 8,
    },
  },
  {
    id: "outline",
    label: "Contorno",
    description: "Transparente con borde",
    style: {
      backgroundColor: "#00000000",
      textColor: "#e8eaed",
      borderColor: "#72757a",
      backgroundColorHover: "#ffffff12",
      borderRadius: 6,
      fontSize: 8,
    },
  },
  {
    id: "ghost",
    label: "Fantasma",
    description: "Sin fondo, texto suave",
    style: {
      backgroundColor: "#00000000",
      textColor: "#c8cad0",
      borderColor: "#ffffff22",
      backgroundColorHover: "#ffffff0d",
      borderRadius: 4,
      fontSize: 8,
    },
  },
  {
    id: "danger",
    label: "Peligro",
    description: "Rojo suave (Quit)",
    style: {
      backgroundColor: "#2b1518",
      textColor: "#e8a0a8",
      borderColor: "#8b3a42",
      backgroundColorHover: "#3d1c22",
      borderRadius: 6,
      fontSize: 8,
    },
  },
  {
    id: "gold",
    label: "Oro",
    description: "Monedas / premium",
    style: {
      backgroundColor: "#252830",
      textColor: "#f0c040",
      borderColor: "#5c4a18",
      backgroundColorHover: "#2f323c",
      borderRadius: 999,
      fontSize: 7,
    },
  },
  {
    id: "compact",
    label: "Compacto",
    description: "Options / Mods pequeño",
    style: {
      backgroundColor: "#2b2e33",
      textColor: "#e8eaed",
      borderColor: "#5b5f66",
      backgroundColorHover: "#35383d",
      borderRadius: 0,
      fontSize: 7,
    },
  },
  {
    id: "event",
    label: "Evento",
    description: "Destacado naranja para eventos",
    style: {
      backgroundColor: "#3d2810",
      textColor: "#ffc857",
      borderColor: "#8a5a18",
      backgroundColorHover: "#4d3418",
      borderRadius: 8,
      fontSize: 9,
      fontWeight: "medium",
    },
  },
  {
    id: "skyblock",
    label: "Skyblock",
    description: "Azul cielo para islas",
    style: {
      backgroundColor: "#152535",
      textColor: "#7ec8e8",
      borderColor: "#2a5a78",
      backgroundColorHover: "#1c3045",
      borderRadius: 8,
      fontSize: 8,
    },
  },
  {
    id: "pvp",
    label: "PvP",
    description: "Rojo intenso para combate",
    style: {
      backgroundColor: "#3a1218",
      textColor: "#ff8a94",
      borderColor: "#8b2838",
      backgroundColorHover: "#4a1820",
      borderRadius: 6,
      fontSize: 8,
      fontWeight: "medium",
    },
  },
  {
    id: "minigame",
    label: "Minijuegos",
    description: "Púrpura para party games",
    style: {
      backgroundColor: "#2a1840",
      textColor: "#c9a0ff",
      borderColor: "#5b3a8a",
      backgroundColorHover: "#352050",
      borderRadius: 8,
      fontSize: 8,
    },
  },
  {
    id: "ranked",
    label: "Competitivo",
    description: "Azul para ranked / torneos",
    style: {
      backgroundColor: "#142238",
      textColor: "#6eb5ff",
      borderColor: "#2a5080",
      backgroundColorHover: "#1a2d48",
      borderRadius: 8,
      fontSize: 8,
      fontWeight: "medium",
    },
  },
];

export function asGameMenuStyle(style?: HubElementStyle): GameMenuStyle {
  return (style ?? {}) as GameMenuStyle;
}

export function resolveGameMenuBorderColor(style?: HubElementStyle): string {
  const s = asGameMenuStyle(style);
  if (s.borderColor) return s.borderColor;
  const bg = s.backgroundColor ?? "#2b2e33";
  return lighten(bg, 0.28);
}

export function resolveGameMenuHoverBg(style?: HubElementStyle): string {
  const s = asGameMenuStyle(style);
  if (s.backgroundColorHover) return s.backgroundColorHover;
  const bg = s.backgroundColor ?? "#2b2e33";
  return lighten(bg, 0.12);
}

/** Variables CSS para el preview fiel en el canvas. */
export function gameMenuPreviewCssVars(element: HubElement): CSSProperties {
  const s = asGameMenuStyle(element.style);
  const bg = s.backgroundColor ?? "#2b2e33";
  const opacity = s.opacity != null ? Math.min(100, Math.max(0, s.opacity)) / 100 : 1;
  return {
    ["--gm-btn-bg" as string]: bg,
    ["--gm-btn-border" as string]: resolveGameMenuBorderColor(s),
    ["--gm-btn-text" as string]: s.textColor ?? "#e8eaed",
    ["--gm-btn-hover" as string]: resolveGameMenuHoverBg(s),
    ["--gm-btn-radius" as string]: `${s.borderRadius ?? 0}px`,
    ["--gm-btn-size" as string]: `${s.fontSize ?? 8}px`,
    ["--gm-btn-weight" as string]: s.fontWeight === "bold" ? "700" : s.fontWeight === "medium" ? "500" : "400",
    opacity,
    fontWeight: s.fontWeight === "bold" ? 700 : s.fontWeight === "medium" ? 500 : 400,
    fontSize: s.fontSize ?? 8,
    borderRadius: s.borderRadius ?? 0,
  };
}

export function gameMenuExportColors(element: HubElement): {
  bg: string;
  bgHover: string;
  border: string;
  textColor: string;
} {
  const s = element.style;
  const bg = s.backgroundColor || "#2b2e33";
  return {
    bg,
    bgHover: resolveGameMenuHoverBg(s),
    border: resolveGameMenuBorderColor(s),
    textColor: s.textColor || "#e8eaed",
  };
}

export function isGameMenuTransparentBg(style?: HubElementStyle): boolean {
  const bg = style?.backgroundColor?.trim().toLowerCase();
  if (!bg || bg === "transparent") return true;
  if (bg.length === 9 && bg.startsWith("#") && bg.endsWith("00")) return true;
  return false;
}

export function gameMenuPresetStyle(id: string): GameMenuStyle | undefined {
  return GAME_MENU_STYLE_PRESETS.find((p) => p.id === id)?.style;
}

export function matchGameMenuPreset(style?: HubElementStyle): string | null {
  if (!style) return null;
  const s = asGameMenuStyle(style);
  for (const preset of GAME_MENU_STYLE_PRESETS) {
    const p = preset.style;
    const same =
      (p.backgroundColor ?? "#2b2e33") === (s.backgroundColor ?? "#2b2e33") &&
      (p.textColor ?? "#e8eaed") === (s.textColor ?? "#e8eaed") &&
      (p.borderColor ?? resolveGameMenuBorderColor(p)) ===
        (s.borderColor ?? resolveGameMenuBorderColor(s)) &&
      (p.borderRadius ?? 0) === (s.borderRadius ?? 0);
    if (same) return preset.id;
  }
  return null;
}
