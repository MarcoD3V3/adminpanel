import type { HubElement } from "../types/hub-layout";

/** Quita `;` erróneos que React rechaza en style={{ ... }}. */
export function sanitizeHubCssValue(value: string | number): string | number {
  if (typeof value === "number") return value;
  return String(value)
    .replace(/;+/g, "")
    .trim();
}

/** Propiedades reservadas al motor de layout (no editables por CSS avanzado). */
export const HUB_CSS_LAYOUT_PROTECTED_KEYS = new Set([
  "width",
  "height",
  "left",
  "top",
  "right",
  "bottom",
  "inset",
  "position",
  "zIndex",
  "z-index",
]);

const HUB_CSS_UNITLESS_KEYS = new Set([
  "opacity",
  "flex",
  "flexGrow",
  "flexShrink",
  "flex-grow",
  "flex-shrink",
  "order",
  "zIndex",
  "z-index",
  "fontWeight",
  "font-weight",
  "lineHeight",
  "line-height",
  "zoom",
]);

const HUB_CSS_AUTO_PX_KEYS = new Set([
  "gap",
  "rowGap",
  "columnGap",
  "row-gap",
  "column-gap",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "borderRadius",
  "border-radius",
  "borderWidth",
  "border-width",
  "fontSize",
  "font-size",
  "top",
  "right",
  "bottom",
  "left",
]);

function camelToKebab(key: string): string {
  return key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/** Normaliza valores numéricos sueltos a px cuando corresponde (gap: 10 → 10px). */
export function normalizeHubCssValue(key: string, value: string | number): string | number {
  if (typeof value !== "number" || !Number.isFinite(value)) return value;
  if (HUB_CSS_UNITLESS_KEYS.has(key) || HUB_CSS_UNITLESS_KEYS.has(camelToKebab(key))) return value;
  if (HUB_CSS_AUTO_PX_KEYS.has(key) || HUB_CSS_AUTO_PX_KEYS.has(camelToKebab(key))) return `${value}px`;
  return value;
}

/** Evita mezclar shorthand + longhand (React warning en runtime). */
export function coalesceHubInlineStyle(
  style: Record<string, string | number>
): Record<string, string | number> {
  const out = { ...style };
  if ("backgroundColor" in out && "background" in out) delete out.background;
  if ("backgroundImage" in out && "background" in out) delete out.background;
  if ("backgroundSize" in out && "background" in out) delete out.background;
  if ("borderWidth" in out && "border" in out) delete out.border;
  if ("borderStyle" in out && "border" in out) delete out.border;
  if ("borderColor" in out && "border" in out) delete out.border;
  return out;
}

/** Convierte `element.css` a estilos inline; el CSS avanzado tiene prioridad sobre presets del panel. */
export function hubElementCssToStyle(
  css: HubElement["css"] | undefined
): Record<string, string | number> {
  if (!css) return {};
  const out: Record<string, string | number> = {};
  for (const [rawKey, rawValue] of Object.entries(css)) {
    const key = rawKey.trim();
    if (!key || HUB_CSS_LAYOUT_PROTECTED_KEYS.has(key)) continue;
    if (rawValue === undefined || rawValue === null || rawValue === "") continue;
    const clean = sanitizeHubCssValue(rawValue);
    if (clean === "") continue;
    out[key] = normalizeHubCssValue(key, clean);
  }
  return coalesceHubInlineStyle(out);
}

/** Fusiona capas de estilo; las últimas capas ganan (CSS avanzado al final). */
export function mergeHubElementStyles(
  ...layers: Array<Record<string, string | number> | undefined>
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const layer of layers) {
    if (!layer) continue;
    Object.assign(out, layer);
  }
  return out;
}

/** Estilo final del elemento: panel + presets + CSS avanzado (CSS gana). */
export function hubElementPresentationStyle(
  element: HubElement,
  base: Record<string, string | number> = {}
): Record<string, string | number> {
  return mergeHubElementStyles(base, hubElementCssToStyle(element.css));
}

function isCssNoneLike(value: string | number | undefined): boolean {
  if (value === undefined || value === null) return false;
  const v = String(value).trim().toLowerCase();
  return v === "none" || v === "0" || v === "0px" || v === "hidden" || v === "transparent";
}

/**
 * Clases utilitarias con !important para que el CSS avanzado gane sobre presets (.hub-control-style-*).
 */
export function hubElementCssForceClasses(element: HubElement): string {
  const css = element.css;
  if (!css) return "";
  const classes: string[] = [];
  const borderKeys = [
    "border",
    "borderTop",
    "borderRight",
    "borderBottom",
    "borderLeft",
    "border-top",
    "border-right",
    "border-bottom",
    "border-left",
  ] as const;
  const borderOff =
    borderKeys.some((k) => isCssNoneLike(css[k])) ||
    css.borderWidth === 0 ||
    css.borderWidth === "0" ||
    css.borderWidth === "0px" ||
    css["border-width"] === 0 ||
    css["border-width"] === "0" ||
    css["border-width"] === "0px";
  if (borderOff) classes.push("hub-css-force-no-border");
  if (
    css.borderRadius === 0 ||
    css.borderRadius === "0" ||
    css.borderRadius === "0px" ||
    isCssNoneLike(css.borderRadius)
  ) {
    classes.push("hub-css-force-no-radius");
  }
  if (isCssNoneLike(css.boxShadow)) classes.push("hub-css-force-no-shadow");
  if (isCssNoneLike(css.outline)) classes.push("hub-css-force-no-outline");
  return classes.join(" ");
}
