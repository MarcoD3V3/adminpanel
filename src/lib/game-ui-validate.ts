/** Validación y reparación de craftlauncher-ui.json (espacio de diseño 480×270). */
export const GAME_DESIGN_W = 480;
export const GAME_DESIGN_H = 270;

export type NormalizedGameUiElement = {
  type: "button" | "label";
  text: string;
  anchorX: "left";
  anchorY: "top";
  offsetX: number;
  offsetY: number;
  x: number;
  y: number;
  w: number;
  h: number;
  action: string;
  url?: string;
  server?: string;
  binding?: string;
  bg?: string;
  bgHover?: string;
  border?: string;
  textColor?: string;
};

export type NormalizedGameUi = {
  schema: number;
  designWidth: number;
  designHeight: number;
  targetWindowWidth?: number;
  targetWindowHeight?: number;
  hideVanillaDecor: boolean;
  elements: NormalizedGameUiElement[];
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function asInt(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

export function normalizeGameUiElement(
  el: Record<string, unknown> | null | undefined,
  designW = GAME_DESIGN_W,
  designH = GAME_DESIGN_H
): NormalizedGameUiElement | null {
  if (!el || typeof el !== "object") return null;

  const type = el.type === "label" ? "label" : "button";
  const w = clamp(asInt(el.w, 98), 1, designW);
  const h = clamp(asInt(el.h, 11), 1, designH);

  let x = asInt(el.x, Number.NaN);
  let y = asInt(el.y, Number.NaN);
  if (!Number.isFinite(x)) x = asInt(el.offsetX, 0);
  if (!Number.isFinite(y)) y = asInt(el.offsetY, 0);

  x = clamp(x, 0, Math.max(0, designW - w));
  y = clamp(y, 0, Math.max(0, designH - h));

  const text = typeof el.text === "string" ? el.text : String(el.text ?? "");
  const out: NormalizedGameUiElement = {
    type,
    text,
    anchorX: "left",
    anchorY: "top",
    offsetX: x,
    offsetY: y,
    x,
    y,
    w,
    h,
    action: typeof el.action === "string" ? el.action : "none",
  };

  if (el.url) out.url = String(el.url);
  if (el.action === "join_server" && el.server) out.server = String(el.server).trim();
  if (el.binding) out.binding = String(el.binding);
  if (el.bg) out.bg = String(el.bg);
  if (el.bgHover) out.bgHover = String(el.bgHover);
  if (el.border) out.border = String(el.border);
  if (el.textColor) out.textColor = String(el.textColor);

  return out;
}

export function normalizeGameUi(
  ui: Record<string, unknown> | null | undefined,
  launchWindow: { width?: number; height?: number } | null = null
): { ui: NormalizedGameUi; warnings: string[] } {
  const warnings: string[] = [];
  const designW = asInt(ui?.designWidth, GAME_DESIGN_W);
  const designH = asInt(ui?.designHeight, GAME_DESIGN_H);
  const src = Array.isArray(ui?.elements) ? ui.elements : [];

  if (!Array.isArray(ui?.elements)) {
    warnings.push("El menú no tenía lista de elementos — se usará vacío.");
  }

  const elements: NormalizedGameUiElement[] = [];
  for (const raw of src) {
    const norm = normalizeGameUiElement(raw as Record<string, unknown>, designW, designH);
    if (!norm) {
      warnings.push("Se omitió un elemento inválido del menú.");
      continue;
    }
    if (norm.type === "label" && !norm.text.trim()) {
      warnings.push("Etiqueta vacía omitida.");
      continue;
    }
    if (norm.type === "button" && !norm.text.trim() && norm.action === "none") {
      warnings.push("Botón sin texto omitido.");
      continue;
    }
    if (norm.action === "join_server" && !norm.server?.trim()) {
      warnings.push(`Botón "${norm.text || "servidor"}" sin IP — configura el dominio en el editor.`);
    }
    elements.push(norm);
  }

  const tw = launchWindow?.width ?? ui?.targetWindowWidth;
  const th = launchWindow?.height ?? ui?.targetWindowHeight;

  return {
    ui: {
      schema: 2,
      designWidth: designW,
      designHeight: designH,
      ...(Number.isFinite(Number(tw)) && Number(tw) > 0
        ? { targetWindowWidth: Math.round(Number(tw)) }
        : {}),
      ...(Number.isFinite(Number(th)) && Number(th) > 0
        ? { targetWindowHeight: Math.round(Number(th)) }
        : {}),
      hideVanillaDecor: ui?.hideVanillaDecor !== false,
      elements,
    },
    warnings,
  };
}
