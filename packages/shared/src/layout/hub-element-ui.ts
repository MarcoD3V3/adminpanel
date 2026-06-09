import type { HubElement } from "../types/hub-layout";
import { coalesceHubInlineStyle, hubElementCssForceClasses, hubElementCssToStyle } from "./hub-element-css";
import { hubTextStyleClassForElement, hubTextStyleInlineCss } from "./hub-text-style";

export type HubElementUi = {
  contentScale: number;
  hideScrollbar: boolean;
  scrollY: "auto" | "hidden" | "visible";
  gridColumns: number;
  gridGap: number;
  gridMinWidth: number;
};

function readConst(constants: Record<string, unknown> | undefined, key: string): string {
  const v = constants?.[key];
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function truthyConst(constants: Record<string, unknown> | undefined, key: string): boolean {
  const v = readConst(constants, key).toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

export function resolveHubElementUi(element: HubElement): HubElementUi {
  const c = element.logic?.constants;
  const scaleRaw = Number(readConst(c, "CONTENT_SCALE") || "1");
  const contentScale = Number.isFinite(scaleRaw) ? Math.min(1, Math.max(0.45, scaleRaw)) : 1;
  const gridColumnsRaw = parseInt(readConst(c, "GRID_COLUMNS") || "0", 10);
  const gridGapRaw = parseInt(readConst(c, "GRID_GAP") || "8", 10);
  const gridMinRaw = parseInt(readConst(c, "GRID_MIN_WIDTH") || "140", 10);

  return {
    contentScale,
    hideScrollbar: truthyConst(c, "HIDE_SCROLLBAR"),
    scrollY: readConst(c, "SCROLL_Y") === "hidden" ? "hidden" : "auto",
    gridColumns: Number.isFinite(gridColumnsRaw) ? Math.min(8, Math.max(0, gridColumnsRaw)) : 0,
    gridGap: Number.isFinite(gridGapRaw) ? Math.min(32, Math.max(2, gridGapRaw)) : 8,
    gridMinWidth: Number.isFinite(gridMinRaw) ? Math.min(320, Math.max(80, gridMinRaw)) : 140,
  };
}

/** Variables CSS para que el launcher respete tamaños del Hub Builder. */
export function hubElementUiCssVars(element: HubElement): Record<string, string> {
  const ui = resolveHubElementUi(element);
  const baseFont = element.style.fontSize ?? 13;
  const vars: Record<string, string> = {
    "--hub-content-scale": String(ui.contentScale),
    "--hub-base-font": `${baseFont}px`,
    "--hub-radius": `${element.style.borderRadius ?? 10}px`,
    "--hub-grid-gap": `${ui.gridGap}px`,
    "--hub-grid-min": `${ui.gridMinWidth}px`,
  };
  if (ui.gridColumns > 0) {
    vars["--hub-grid-template"] = `repeat(${ui.gridColumns}, minmax(0, 1fr))`;
  }
  return vars;
}

export function hubGridStyle(ui: HubElementUi): Record<string, string | number> {
  if (ui.gridColumns > 0) {
    return {
      display: "grid",
      gridTemplateColumns: `repeat(${ui.gridColumns}, minmax(0, 1fr))`,
      gap: ui.gridGap,
    };
  }
  return {
    display: "grid",
    gridTemplateColumns: `repeat(auto-fill, minmax(${ui.gridMinWidth}px, 1fr))`,
    gap: ui.gridGap,
  };
}

export const HUB_MINIMAL_STYLE_COUNT = 10;

export const HUB_UI_CONSTANT_KEYS = {
  CONTENT_SCALE: "CONTENT_SCALE",
  HIDE_SCROLLBAR: "HIDE_SCROLLBAR",
  SCROLL_Y: "SCROLL_Y",
  GRID_COLUMNS: "GRID_COLUMNS",
  GRID_GAP: "GRID_GAP",
  GRID_MIN_WIDTH: "GRID_MIN_WIDTH",
  INSTANCE_SORT: "INSTANCE_SORT",
  INSTANCE_ORDER: "INSTANCE_ORDER",
  AVATAR_SIZE: "AVATAR_SIZE",
  AVATAR_LAYOUT: "AVATAR_LAYOUT",
  AVATAR_ITEM_ALIGN: "AVATAR_ITEM_ALIGN",
  AVATAR_DISTRIBUTE: "AVATAR_DISTRIBUTE",
  AVATAR_GROUP_GAP: "AVATAR_GROUP_GAP",
  INSTANCE_GROUPS: "INSTANCE_GROUPS",
  PILL_SELECT_STYLE: "PILL_SELECT_STYLE",
  SEARCH_FIELD_STYLE: "SEARCH_FIELD_STYLE",
  LIST_CARD_STYLE: "LIST_CARD_STYLE",
  TAB_STRIP_STYLE: "TAB_STRIP_STYLE",
  PANEL_SURFACE_STYLE: "PANEL_SURFACE_STYLE",
  CONTROL_STYLE: "CONTROL_STYLE",
  TEXT_STYLE: "TEXT_STYLE",
  ICON_NAME: "ICON_NAME",
} as const;

/** 10 estilos minimalistas compartidos por todas las familias de UI. */
export const HUB_MINIMAL_STYLE_OPTIONS = [
  { value: "1", label: "Clásico" },
  { value: "2", label: "Cristal" },
  { value: "3", label: "Neón" },
  { value: "4", label: "Línea" },
  { value: "5", label: "Bosque" },
  { value: "6", label: "Humo" },
  { value: "7", label: "Noche" },
  { value: "8", label: "Plata" },
  { value: "9", label: "Arena" },
  { value: "10", label: "Hielo" },
] as const;

export type HubMinimalStyleId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

function clampHubMinimalStyleId(raw: number): HubMinimalStyleId {
  if (!Number.isFinite(raw)) return 1;
  return Math.min(HUB_MINIMAL_STYLE_COUNT, Math.max(1, raw)) as HubMinimalStyleId;
}

function resolveStyleByKey(element: HubElement, key: string): HubMinimalStyleId {
  const raw = parseInt(readConst(element.logic?.constants, key) || "1", 10);
  return clampHubMinimalStyleId(raw);
}

export const GRID_CONFIG_ELEMENT_TYPES = new Set(["mods-results", "mods-catalog", "instance-avatar-grid"]);

export const INSTANCE_GRID_SORT_ELEMENT_TYPES = new Set(["instance-avatar-grid"]);

export const INSTANCE_AVATAR_CONFIG_ELEMENT_TYPES = new Set(["instance-avatar", "instance-avatar-grid"]);

/* ——— Selectores pill ——— */

export const PILL_SELECT_ELEMENT_TYPES = new Set([
  "instance-selector",
  "installed-version-selector",
  "version-selector",
  "dropdown",
  "panel-visibility-select",
  "instance-version-select",
]);

export const PILL_SELECT_STYLE_OPTIONS = HUB_MINIMAL_STYLE_OPTIONS;

export type PillSelectStyleId = HubMinimalStyleId;

export function resolvePillSelectStyle(element: HubElement): PillSelectStyleId {
  return resolveStyleByKey(element, HUB_UI_CONSTANT_KEYS.PILL_SELECT_STYLE);
}

export function hubPillSelectClassName(style: PillSelectStyleId | number): string {
  const id = clampHubMinimalStyleId(Number(style) || 1);
  return `hub-pill-select hub-pill-style-${id}`;
}

/* ——— Campos de texto / buscadores ——— */

export const SEARCH_FIELD_ELEMENT_TYPES = new Set([
  "mods-search",
  "mods-installed-search",
  "input-field",
  "instance-name-input",
]);

export const SEARCH_FIELD_STYLE_OPTIONS = HUB_MINIMAL_STYLE_OPTIONS;

export type SearchFieldStyleId = HubMinimalStyleId;

export function resolveSearchFieldStyle(element: HubElement): SearchFieldStyleId {
  return resolveStyleByKey(element, HUB_UI_CONSTANT_KEYS.SEARCH_FIELD_STYLE);
}

export function hubSearchFieldClassName(style: SearchFieldStyleId | number): string {
  const id = clampHubMinimalStyleId(Number(style) || 1);
  return `hub-search-field hub-search-field-style-${id}`;
}

/* ——— Tarjetas lista mods instalados ——— */

export const LIST_CARD_ELEMENT_TYPES = new Set(["mods-installed-list"]);

export const LIST_CARD_STYLE_OPTIONS = HUB_MINIMAL_STYLE_OPTIONS;

export type ListCardStyleId = HubMinimalStyleId;

export function resolveListCardStyle(element: HubElement): ListCardStyleId {
  return resolveStyleByKey(element, HUB_UI_CONSTANT_KEYS.LIST_CARD_STYLE);
}

export function hubListCardClassName(style: ListCardStyleId | number): string {
  return hubListCardSurfaceClassName(style);
}

/* ——— Pestañas del catálogo ——— */

export const TAB_STRIP_ELEMENT_TYPES = new Set(["mods-tabs"]);

export const TAB_STRIP_STYLE_OPTIONS = HUB_MINIMAL_STYLE_OPTIONS;

export type TabStripStyleId = HubMinimalStyleId;

export function resolveTabStripStyle(element: HubElement): TabStripStyleId {
  return resolveStyleByKey(element, HUB_UI_CONSTANT_KEYS.TAB_STRIP_STYLE);
}

export function hubTabStripClassName(style: TabStripStyleId | number): string {
  return hubTabStripSurfaceClassName(style);
}

/* ——— Panel vista previa mod ——— */

export const PANEL_SURFACE_ELEMENT_TYPES = new Set(["mods-preview"]);

export const PANEL_SURFACE_STYLE_OPTIONS = HUB_MINIMAL_STYLE_OPTIONS;

export type PanelSurfaceStyleId = HubMinimalStyleId;

export function resolvePanelSurfaceStyle(element: HubElement): PanelSurfaceStyleId {
  return resolveStyleByKey(element, HUB_UI_CONSTANT_KEYS.PANEL_SURFACE_STYLE);
}

export function hubPanelSurfaceClassName(style: PanelSurfaceStyleId | number): string {
  const id = clampHubMinimalStyleId(Number(style) || 1);
  return `hub-element-surface-shell hub-panel-surface-style-${id}`;
}

export function hubListCardSurfaceClassName(style: ListCardStyleId | number): string {
  const id = clampHubMinimalStyleId(Number(style) || 1);
  return `hub-element-surface-shell hub-list-card-style-${id}`;
}

export function hubTabStripSurfaceClassName(style: TabStripStyleId | number): string {
  const id = clampHubMinimalStyleId(Number(style) || 1);
  return `hub-element-surface-shell hub-tab-strip-style-${id}`;
}

/* ——— Botones y navegación ——— */

export const MINECRAFT_CONTROL_STYLE_ID = 11 as const;

export const HUB_CONTROL_STYLE_COUNT = HUB_MINIMAL_STYLE_COUNT + 1;

export const CONTROL_ELEMENT_TYPES = new Set([
  "button",
  "nav-item",
  "play-button",
  "play-show-bind",
  "script-button",
]);

export const CONTROL_STYLE_OPTIONS = [
  ...HUB_MINIMAL_STYLE_OPTIONS,
  { value: String(MINECRAFT_CONTROL_STYLE_ID), label: "Minecraft" },
] as const;

export type ControlStyleId = HubMinimalStyleId | typeof MINECRAFT_CONTROL_STYLE_ID;

function clampControlStyleId(raw: number): ControlStyleId {
  if (!Number.isFinite(raw)) return 1;
  if (raw >= MINECRAFT_CONTROL_STYLE_ID) return MINECRAFT_CONTROL_STYLE_ID;
  return clampHubMinimalStyleId(raw);
}

export function resolveControlStyle(element: HubElement): ControlStyleId {
  const raw = parseInt(readConst(element.logic?.constants, HUB_UI_CONSTANT_KEYS.CONTROL_STYLE) || "1", 10);
  return clampControlStyleId(raw);
}

export function hubControlClassName(style: ControlStyleId | number): string {
  const id = clampControlStyleId(Number(style) || 1);
  return `hub-control-style-${id}`;
}

/** Tipos lógicos/invisibles sin selector de estilo visual. */
export const HUB_VISUAL_STYLE_EXCLUDED_TYPES = new Set<HubElement["type"]>([
  "automation-node",
  "show-on-condition",
  "hide-on-condition",
]);

/** Contenedores / listas: no aplicar skin de botón (borde/fondo del preset visual) al marco externo. */
export const HUB_VISUAL_FRAME_SKIN_EXCLUDED_TYPES = new Set<HubElement["type"]>([
  "surface-box",
  "container",
  "visibility-zone",
  "instance-avatar-grid",
  "instance-list",
  "instance-avatar",
  "spacer",
  "divider",
  "launch-panel",
]);

export function hubElementSupportsVisualStyle(elementType: string): boolean {
  return !HUB_VISUAL_STYLE_EXCLUDED_TYPES.has(elementType as HubElement["type"]);
}

export function isMinecraftHubControlStyle(element: HubElement): boolean {
  if (!hubElementSupportsVisualStyle(element.type)) return false;
  return resolveControlStyle(element) === MINECRAFT_CONTROL_STYLE_ID;
}

/** true cuando el preset visual (2–11) debe pintar el elemento; 1 = Clásico usa fondo del Hub. */
export function hubVisualPresetActive(element: HubElement): boolean {
  if (!hubElementSupportsVisualStyle(element.type)) return false;
  return resolveControlStyle(element) !== 1;
}

/** Variables CSS para personalizar el verde del botón Minecraft desde el Hub. */
export function hubMinecraftControlCssVars(element: HubElement): Record<string, string> {
  const face = element.style.backgroundColor?.trim();
  if (!face) return {};
  return { "--hub-mc-face": face };
}

export function hubControlClassForElement(element: HubElement): string {
  if (!hubElementSupportsVisualStyle(element.type)) return "";
  if (HUB_VISUAL_FRAME_SKIN_EXCLUDED_TYPES.has(element.type)) return "";
  if (hubUsesFillControlSkin(element.type)) return "";
  return hubControlClassName(resolveControlStyle(element));
}

/** Clase de preset visual en el botón/control visible (play, nav, icon-button, etc.). */
export function hubControlFillClassForElement(element: HubElement): string {
  if (!hubElementSupportsVisualStyle(element.type)) return "";
  if (!hubUsesFillControlSkin(element.type)) return "";
  return hubControlClassName(resolveControlStyle(element));
}

/** Botones/controles cuyo preset se pinta en el elemento fill, no en el shell externo. */
export const HUB_FILL_CONTROL_SKIN_TYPES = new Set<HubElement["type"]>([
  "button",
  "nav-item",
  "play-button",
  "play-show-bind",
  "script-button",
  "icon-button",
  "toast-trigger",
  "action-chip",
  "show-on-click",
  "toggle-visible",
  "launch-dismiss-button",
]);

export function hubUsesFillControlSkin(elementType: string): boolean {
  return HUB_FILL_CONTROL_SKIN_TYPES.has(elementType as HubElement["type"]);
}

export function hubElementVisualSkin(element: HubElement): {
  className: string;
  style: Record<string, string | number>;
} {
  if (
    !hubElementSupportsVisualStyle(element.type) ||
    HUB_VISUAL_FRAME_SKIN_EXCLUDED_TYPES.has(element.type) ||
    hubUsesFillControlSkin(element.type)
  ) {
    return { className: "", style: {} };
  }
  const styleId = resolveControlStyle(element);
  const style: Record<string, string | number> = {};
  if (styleId === MINECRAFT_CONTROL_STYLE_ID) {
    Object.assign(style, hubMinecraftControlCssVars(element));
  } else if (styleId === 1 && element.style.backgroundColor?.trim()) {
    style["--hub-control-face"] = element.style.backgroundColor.trim();
  }
  return {
    className: hubControlClassName(styleId),
    style,
  };
}

/** Props de raíz (className + style) para aplicar el preset visual en runtime/preview. */
export function hubVisualRootProps(
  element: HubElement,
  options?: { className?: string; style?: Record<string, string | number> }
): { className?: string; style: Record<string, string | number> } {
  const skin = hubElementVisualSkin(element);
  const preset = hubVisualPresetActive(element);
  const cssLayer = hubElementCssToStyle(element.css);
  let style: Record<string, string | number> = { ...(options?.style ?? {}), ...skin.style };
  if (preset) {
    for (const key of ["background", "backgroundColor", "border", "borderRadius", "boxShadow"] as const) {
      if (key in cssLayer) continue;
      delete style[key];
    }
  }
  style = { ...style, ...cssLayer };
  return {
    className: [skin.className, hubElementCssForceClasses(element), options?.className]
      .filter(Boolean)
      .join(" ") || undefined,
    style,
  };
}

/** Props del control visible (capa fill): preset visual + CSS avanzado, sin fondo duplicado en el marco. */
export function hubFillControlBtnProps(
  element: HubElement,
  className: string,
  classicStyle: Record<string, string | number | undefined>
): { className: string; style: Record<string, string | number> } {
  const preset = hubVisualPresetActive(element);
  const skinClass = hubControlFillClassForElement(element);
  const textClass = hubTextStyleClassForElement(element);
  const cssForceClass = hubElementCssForceClasses(element);
  const cssLayer = hubElementCssToStyle(element.css);
  const mergedClassic = Object.fromEntries(
    Object.entries(classicStyle).filter(([, v]) => v !== undefined)
  ) as Record<string, string | number>;

  if (!preset) {
    const styleId = resolveControlStyle(element);
    const classicVars: Record<string, string> = {};
    const face = element.style.backgroundColor?.trim();
    if (styleId === 1 && face) {
      classicVars["--hub-control-face"] = face;
    }
    return {
      className: [className, skinClass, textClass, cssForceClass].filter(Boolean).join(" "),
      style: coalesceHubInlineStyle({
        ...mergedClassic,
        ...classicVars,
        ...hubTextStyleInlineCss(element),
        ...cssLayer,
      }),
    };
  }

  const {
    background: _bg,
    backgroundColor: _bgc,
    border: _border,
    borderRadius: _radius,
    boxShadow: _shadow,
    ...rest
  } = mergedClassic;

  return {
    className: [className, skinClass, textClass, cssForceClass].filter(Boolean).join(" "),
    style: coalesceHubInlineStyle({
      ...rest,
      ...hubTextStyleInlineCss(element),
      ...(isMinecraftHubControlStyle(element) ? hubMinecraftControlCssVars(element) : {}),
      ...cssLayer,
    }),
  };
}

/** Configuración del selector de estilo en el panel de propiedades. */
export type HubStyleEditorConfig = {
  label: string;
  constantKey: (typeof HUB_UI_CONSTANT_KEYS)[keyof typeof HUB_UI_CONSTANT_KEYS];
  options: typeof HUB_MINIMAL_STYLE_OPTIONS;
};

export function hubStyleEditorConfigsForElement(elementType: string): HubStyleEditorConfig[] {
  const configs: HubStyleEditorConfig[] = [];
  if (PILL_SELECT_ELEMENT_TYPES.has(elementType)) {
    configs.push({
      label: "Estilo del selector",
      constantKey: HUB_UI_CONSTANT_KEYS.PILL_SELECT_STYLE,
      options: PILL_SELECT_STYLE_OPTIONS,
    });
  }
  if (SEARCH_FIELD_ELEMENT_TYPES.has(elementType)) {
    configs.push({
      label: "Estilo del campo",
      constantKey: HUB_UI_CONSTANT_KEYS.SEARCH_FIELD_STYLE,
      options: SEARCH_FIELD_STYLE_OPTIONS,
    });
  }
  if (LIST_CARD_ELEMENT_TYPES.has(elementType)) {
    configs.push({
      label: "Estilo de la lista",
      constantKey: HUB_UI_CONSTANT_KEYS.LIST_CARD_STYLE,
      options: LIST_CARD_STYLE_OPTIONS,
    });
  }
  if (TAB_STRIP_ELEMENT_TYPES.has(elementType)) {
    configs.push({
      label: "Estilo de pestañas",
      constantKey: HUB_UI_CONSTANT_KEYS.TAB_STRIP_STYLE,
      options: TAB_STRIP_STYLE_OPTIONS,
    });
  }
  if (PANEL_SURFACE_ELEMENT_TYPES.has(elementType)) {
    configs.push({
      label: "Estilo del panel",
      constantKey: HUB_UI_CONSTANT_KEYS.PANEL_SURFACE_STYLE,
      options: PANEL_SURFACE_STYLE_OPTIONS,
    });
  }
  return configs;
}

/** Wrapper de superficie para listas, pestañas y paneles (launcher + preview). */
export function hubElementSurfaceWrapperClass(element: HubElement): string | null {
  const type = element.type;
  if (LIST_CARD_ELEMENT_TYPES.has(type)) {
    return hubListCardClassName(resolveListCardStyle(element));
  }
  if (TAB_STRIP_ELEMENT_TYPES.has(type)) {
    return hubTabStripClassName(resolveTabStripStyle(element));
  }
  if (PANEL_SURFACE_ELEMENT_TYPES.has(type)) {
    return hubPanelSurfaceClassName(resolvePanelSurfaceStyle(element));
  }
  return null;
}
