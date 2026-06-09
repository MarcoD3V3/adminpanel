/** Validación y reparación de craftlauncher-ui.json (espacio de diseño 480×270). */
export const GAME_DESIGN_W = 480;
export const GAME_DESIGN_H = 270;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function asInt(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

/** Repara un elemento para que el mod y el editor coincidan en cualquier PC. */
export function normalizeGameUiElement(el, designW = GAME_DESIGN_W, designH = GAME_DESIGN_H) {
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
  const out = {
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

/** Normaliza menú completo y devuelve avisos. */
export function normalizeGameUi(ui, launchWindow = null) {
  const warnings = [];
  const designW = asInt(ui?.designWidth, GAME_DESIGN_W);
  const designH = asInt(ui?.designHeight, GAME_DESIGN_H);
  const src = Array.isArray(ui?.elements) ? ui.elements : [];

  if (!Array.isArray(ui?.elements)) {
    warnings.push("El menú no tenía lista de elementos — se usará vacío.");
  }

  const elements = [];
  for (const raw of src) {
    const norm = normalizeGameUiElement(raw, designW, designH);
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
      ...(Number.isFinite(Number(tw)) && Number(tw) > 0 ? { targetWindowWidth: Math.round(Number(tw)) } : {}),
      ...(Number.isFinite(Number(th)) && Number(th) > 0 ? { targetWindowHeight: Math.round(Number(th)) } : {}),
      hideVanillaDecor: ui?.hideVanillaDecor !== false,
      elements,
    },
    warnings,
  };
}

export function validateGameUiFile(content) {
  if (!content || !String(content).trim()) {
    return { ok: false, errors: ["craftlauncher-ui.json está vacío"], warnings: [], ui: null };
  }
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    return {
      ok: false,
      errors: [`JSON inválido: ${e instanceof Error ? e.message : String(e)}`],
      warnings: [],
      ui: null,
    };
  }
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, errors: ["El menú no es un objeto JSON"], warnings: [], ui: null };
  }
  const { ui, warnings } = normalizeGameUi(parsed);
  return { ok: true, errors: [], warnings, ui };
}

export function validateLoadingUi(ui) {
  const errors = [];
  const warnings = [];
  if (!ui || typeof ui !== "object") {
    return { ok: false, errors: ["Pantalla de carga inválida"], warnings, ui: null };
  }
  if (!ui.progress || typeof ui.progress !== "object") {
    warnings.push("Falta barra de progreso en la pantalla de carga — se usará valor por defecto.");
  }
  return { ok: true, errors, warnings, ui };
}
