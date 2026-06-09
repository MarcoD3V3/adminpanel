export type Rgba = { r: number; g: number; b: number; a: number };

function clampByte(n: number): number {
  return Math.min(255, Math.max(0, Math.round(n)));
}

function clampAlpha(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function parseHexChannel(pair: string): number {
  return parseInt(pair, 16);
}

const DEFAULT_RGBA: Rgba = { r: 20, g: 22, b: 26, a: 1 };

/** Convierte un valor CSS guardado en el layout a RGBA para el picker. */
export function parseHubColor(value: string | undefined, fallback?: string): Rgba {
  const raw = value?.trim().toLowerCase();
  if (!raw) {
    if (fallback?.trim()) return parseHubColor(fallback, undefined);
    return DEFAULT_RGBA;
  }

  if (raw === "transparent") {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  const hex6 = raw.match(/^#([0-9a-f]{6})$/i);
  if (hex6) {
    const h = hex6[1];
    return {
      r: parseHexChannel(h.slice(0, 2)),
      g: parseHexChannel(h.slice(2, 4)),
      b: parseHexChannel(h.slice(4, 6)),
      a: 1,
    };
  }

  const hex3 = raw.match(/^#([0-9a-f]{3})$/i);
  if (hex3) {
    const h = hex3[1];
    return {
      r: parseHexChannel(h[0] + h[0]),
      g: parseHexChannel(h[1] + h[1]),
      b: parseHexChannel(h[2] + h[2]),
      a: 1,
    };
  }

  const hex8 = raw.match(/^#([0-9a-f]{8})$/i);
  if (hex8) {
    const h = hex8[1];
    return {
      r: parseHexChannel(h.slice(0, 2)),
      g: parseHexChannel(h.slice(2, 4)),
      b: parseHexChannel(h.slice(4, 6)),
      a: clampAlpha(parseHexChannel(h.slice(6, 8)) / 255),
    };
  }

  const rgb = raw.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/);
  if (rgb) {
    return {
      r: clampByte(Number(rgb[1])),
      g: clampByte(Number(rgb[2])),
      b: clampByte(Number(rgb[3])),
      a: rgb[4] !== undefined ? clampAlpha(Number(rgb[4])) : 1,
    };
  }

  if (fallback?.trim() && fallback.trim().toLowerCase() !== raw) {
    return parseHubColor(fallback, undefined);
  }
  return DEFAULT_RGBA;
}

/** Serializa RGBA al formato que guardamos en el hub (hex o rgba). */
export function formatHubColor({ r, g, b, a }: Rgba): string {
  const alpha = clampAlpha(a);
  if (alpha <= 0) return "transparent";
  const R = clampByte(r);
  const G = clampByte(g);
  const B = clampByte(b);
  if (alpha >= 1) {
    return `#${[R, G, B].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  }
  const aStr = Math.round(alpha * 1000) / 1000;
  return `rgba(${R}, ${G}, ${B}, ${aStr})`;
}

export function hubColorToPickerHex(color: Rgba): string {
  const { r, g, b } = color;
  return `#${[r, g, b].map((c) => clampByte(c).toString(16).padStart(2, "0")).join("")}`;
}

export function isCssColorLiteral(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  const v = value.trim();
  if (v === "transparent") return true;
  if (v.startsWith("var(") || v.startsWith("url(")) return true;
  return (
    /^#[0-9A-Fa-f]{3,8}$/.test(v) ||
    /^rgba?\(/i.test(v) ||
    /^hsla?\(/i.test(v)
  );
}
