export const DEFAULT_HUB_TEXT_COLOR = "#d7d8da";
export const DEFAULT_HUB_SURFACE_BG = "#14161a";
export const DEFAULT_HUB_PLAY_BG = "#496f4f";

export function normalizeHexColor(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9A-Fa-f]{3}$/.test(trimmed)) {
    const h = trimmed.slice(1);
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase();
  }
  return fallback;
}

/** Color de texto (#hex). */
export function resolveHubTextColor(value?: string, fallback = DEFAULT_HUB_TEXT_COLOR): string {
  return normalizeHexColor(value, fallback);
}

/**
 * Fondo de elementos Hub: hex, rgb/rgba, hsl/hsla, transparent, var(), url().
 * Misma lógica en Hub Builder y launcher Electron.
 */
export function resolveHubBackgroundColor(
  value?: string,
  fallback = DEFAULT_HUB_SURFACE_BG
): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (trimmed.startsWith("var(") || trimmed.startsWith("url(")) return trimmed;
  if (
    trimmed === "transparent" ||
    /^rgba?\(/i.test(trimmed) ||
    /^hsla?\(/i.test(trimmed) ||
    /^#[0-9A-Fa-f]{3,8}$/i.test(trimmed)
  ) {
    return trimmed;
  }
  return normalizeHexColor(value, fallback);
}
