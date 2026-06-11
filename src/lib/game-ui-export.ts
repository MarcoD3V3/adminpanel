import type { HubLayout, HubElement, HubElementAction, HubElementStyle } from "@/types/hub-builder";
import { gameMenuExportColors, gameMenuPresetStyle } from "@/lib/game-menu-styles";
import type { GameMenuBinding } from "@/lib/game-menu-bindings";
import { normalizeGameUi } from "@/lib/game-ui-validate";

/** Pantalla del Hub que representa el menú in-game de Minecraft. */
export const GAME_MENU_SCREEN_ID = "craft-game-menu";
export const GAME_MENU_W = 480;
export const GAME_MENU_H = 270;
/** Ventana de referencia “pantalla grande” (1080p → GUI 480×270 en Minecraft). */
export const GAME_MENU_LARGE_WINDOW_W = 1920;
export const GAME_MENU_LARGE_WINDOW_H = 1080;
export const DEFAULT_MINECRAFT_WINDOW = {
  width: GAME_MENU_LARGE_WINDOW_W,
  height: GAME_MENU_LARGE_WINDOW_H,
} as const;
/** Marco ampliado del editor (misma proporción 16:9 que la GUI 480×270). */
export const GAME_MENU_FRAME_W = 854;
export const GAME_MENU_FRAME_H = 480;
export const GAME_MENU_EDITOR_DISPLAY = {
  width: GAME_MENU_FRAME_W,
  height: GAME_MENU_FRAME_H,
} as const;
/** @deprecated Usar DEFAULT_MINECRAFT_WINDOW (ventana) o GAME_MENU_EDITOR_DISPLAY (canvas). */
export const DEFAULT_MINECRAFT_FRAME = GAME_MENU_EDITOR_DISPLAY;

/** Detecta la resolución útil del monitor (cada PC puede ser distinto). */
export function detectPrimaryDisplaySize(): { width: number; height: number } {
  if (typeof window === "undefined") {
    return { ...DEFAULT_MINECRAFT_WINDOW };
  }
  const w = window.screen?.availWidth || window.innerWidth || DEFAULT_MINECRAFT_WINDOW.width;
  const h = window.screen?.availHeight || window.innerHeight || DEFAULT_MINECRAFT_WINDOW.height;
  return {
    width: Math.max(854, Math.min(3840, Math.round(w))),
    height: Math.max(480, Math.min(2160, Math.round(h))),
  };
}

/** Ventana simulada → tamaño GUI de Minecraft (lo que usa TitleScreen.width/height). */
export function resolveMinecraftGuiCanvas(windowSize: { width: number; height: number }) {
  const { gw, gh, scale } = minecraftGuiScaledSize(windowSize.width, windowSize.height);
  return {
    windowW: windowSize.width,
    windowH: windowSize.height,
    guiW: gw,
    guiH: gh,
    guiScale: scale,
  };
}

/** Ancla fija left/top desde la posición del editor (evita saltos en el juego). */
export function designAnchorFromElement(el: HubElement): Anchor {
  return {
    anchorX: "left",
    anchorY: "top",
    offsetX: Math.round(el.x),
    offsetY: Math.round(el.y),
  };
}

export type AnchorX = "left" | "center" | "right";
export type AnchorY = "top" | "center" | "bottom";
export type Anchor = { anchorX: AnchorX; offsetX: number; anchorY: AnchorY; offsetY: number };

/** Estilo base de botones del menú in-game (CraftButton). */
export const GAME_MENU_BTN_STYLE = {
  backgroundColor: "#2b2e33",
  textColor: "#e8eaed",
  borderRadius: 0,
  fontSize: 8,
} as const;

const LEGACY_GAME_MENU_IDS = new Set([
  "gm-1",
  "gm-2",
  "gm-3",
  "gm-4",
  "gm-5",
  "gm-6",
  "gm-7",
]);

/** Layout canónico alineado con data/game-ui.json y el juego real. */
export function defaultGameMenuElements(): HubElement[] {
  const mkBtn = (
    id: string,
    zIndex: number,
    label: string,
    anchor: Anchor,
    w: number,
    h: number,
    action: HubElementAction,
    externalUrl?: string,
    style?: Partial<HubElementStyle>
  ): HubElement => {
    const { x, y } = resolveAnchorPosition(anchor, w, h, GAME_MENU_W, GAME_MENU_H);
    return {
      id,
      type: "button",
      x,
      y,
      width: w,
      height: h,
      zIndex,
      label,
      action,
      externalUrl,
      visible: true,
      locked: false,
      style: { ...GAME_MENU_BTN_STYLE, ...style },
    };
  };

  const vanilla = gameMenuPresetStyle("vanilla") ?? GAME_MENU_BTN_STYLE;
  const compact = gameMenuPresetStyle("compact") ?? GAME_MENU_BTN_STYLE;
  const discord = gameMenuPresetStyle("discord") ?? GAME_MENU_BTN_STYLE;
  const danger = gameMenuPresetStyle("danger") ?? GAME_MENU_BTN_STYLE;
  const ghost = gameMenuPresetStyle("ghost") ?? GAME_MENU_BTN_STYLE;

  return [
    mkBtn(
      "gm-single",
      1,
      "Singleplayer",
      { anchorX: "center", anchorY: "top", offsetX: 5, offsetY: 76 },
      98,
      11,
      "play",
      undefined,
      vanilla
    ),
    mkBtn(
      "gm-multi",
      2,
      "Multiplayer",
      { anchorX: "center", anchorY: "center", offsetX: 0, offsetY: 1 },
      98,
      11,
      "none",
      undefined,
      vanilla
    ),
    mkBtn(
      "gm-options",
      3,
      "Options",
      { anchorX: "left", anchorY: "top", offsetX: 69, offsetY: 78 },
      48,
      11,
      "settings",
      undefined,
      compact
    ),
    mkBtn(
      "gm-mods",
      4,
      "Mods",
      { anchorX: "left", anchorY: "top", offsetX: 119, offsetY: 78 },
      48,
      11,
      "mods",
      undefined,
      compact
    ),
    mkBtn(
      "gm-youtube",
      5,
      "YouTube",
      { anchorX: "center", anchorY: "top", offsetX: 1, offsetY: 96 },
      98,
      11,
      "external",
      "https://www.youtube.com",
      danger
    ),
    mkBtn(
      "gm-discord",
      6,
      "Discord",
      { anchorX: "center", anchorY: "top", offsetX: 1, offsetY: 116 },
      98,
      11,
      "external",
      "https://discord.com",
      discord
    ),
    mkBtn(
      "gm-close",
      7,
      "X",
      { anchorX: "right", anchorY: "top", offsetX: 0, offsetY: 0 },
      24,
      20,
      "none",
      undefined,
      ghost
    ),
  ];
}

/** Migra el layout antiguo (botones 200×20) al canónico sin borrar elementos extra. */
export function migrateLegacyGameMenuElements(elements: HubElement[]): HubElement[] {
  const hasLegacy = elements.some(
    (e) =>
      LEGACY_GAME_MENU_IDS.has(e.id) ||
      (e.type === "button" && e.width >= 180 && e.height >= 18 && e.id.startsWith("gm-"))
  );
  if (!hasLegacy) return elements;
  const extras = elements.filter((e) => !LEGACY_GAME_MENU_IDS.has(e.id) && !e.id.startsWith("gm-"));
  const canonical = defaultGameMenuElements();
  const maxZ = Math.max(0, ...elements.map((e) => e.zIndex ?? 0), canonical.length);
  return [
    ...canonical,
    ...extras.map((e, i) => ({ ...e, zIndex: maxZ + 1 + i })),
  ];
}

export type GameUiElement = {
  type: "button" | "label";
  text: string;
  /** Texto dinámico resuelto en el juego (Forge, logo, mods…). */
  binding?: GameMenuBinding;
  /** Posición absoluta en espacio de diseño (480×270); prioridad en el mod. */
  x?: number;
  y?: number;
  anchorX: AnchorX;
  anchorY: AnchorY;
  offsetX: number;
  offsetY: number;
  w: number;
  h: number;
  action: "singleplayer" | "multiplayer" | "options" | "mods" | "quit" | "url" | "join_server" | "none";
  url?: string;
  /** IP o dominio para action join_server. */
  server?: string;
  bg?: string;
  bgHover?: string;
  border?: string;
  textColor?: string;
};

export type GameUiExport = {
  schema: number;
  designWidth?: number;
  designHeight?: number;
  targetWindowWidth?: number;
  targetWindowHeight?: number;
  hideVanillaDecor: boolean;
  elements: GameUiElement[];
};

export type GameMenuAction = GameUiElement["action"];

export const GAME_MENU_ACTIONS: { value: GameMenuAction; label: string }[] = [
  { value: "singleplayer", label: "Singleplayer" },
  { value: "multiplayer", label: "Multiplayer" },
  { value: "options", label: "Opciones" },
  { value: "mods", label: "Mods" },
  { value: "quit", label: "Salir del juego" },
  { value: "url", label: "Abrir enlace (URL)" },
  { value: "join_server", label: "Entrar a servidor (directo)" },
  { value: "none", label: "Sin acción" },
];

const BUTTONISH = new Set([
  "button",
  "play-button",
  "link",
  "nav-item",
  "icon-button",
  "script-button",
  "toggle",
]);

const TEXTISH = new Set([
  "text",
  "launch-hint-text",
  "launch-phase-label",
  "launch-detail-text",
  "launch-version-title",
]);

/** Se exportan al juego como etiqueta de texto (sin botón). */
const WIDGET_AS_LABEL = new Set([
  "chip",
  "minecraft-status-chip",
  "action-chip",
  "stat-card",
  "banner",
]);

/** Solo preview en el Hub; no se envían a Minecraft. */
export const GAME_MENU_PREVIEW_ONLY = new Set([
  "image",
  "spacer",
  "divider",
  "container",
  "surface-box",
  "news-card",
  "profile-widget",
  "instance-avatar",
  "progress-bar",
  "launch-progress-bar",
]);

export function inferAnchor(
  x: number,
  y: number,
  w: number,
  h: number,
  canvasW: number,
  canvasH: number
): Anchor {
  const cx = (canvasW - w) / 2;
  const cy = (canvasH - h) / 2;
  let anchorX: AnchorX = "left";
  let offsetX = Math.round(x);
  if (Math.abs(x - cx) <= 8) {
    anchorX = "center";
    offsetX = Math.round(x - cx);
  } else if (canvasW - (x + w) <= 32 && x > 32) {
    anchorX = "right";
    offsetX = Math.round(canvasW - (x + w));
  }

  let anchorY: AnchorY = "top";
  let offsetY = Math.round(y);
  if (Math.abs(y - cy) <= 8) {
    anchorY = "center";
    offsetY = Math.round(y - cy);
  } else if (canvasH - (y + h) <= 32 && y > 32) {
    anchorY = "bottom";
    offsetY = Math.round(canvasH - (y + h));
  }

  return { anchorX, offsetX, anchorY, offsetY };
}

export function resolveAnchorPosition(
  anchor: Anchor,
  w: number,
  h: number,
  frameW: number,
  frameH: number,
  designW = frameW,
  designH = frameH
): { x: number; y: number } {
  const sx = designW > 0 ? frameW / designW : 1;
  const sy = designH > 0 ? frameH / designH : 1;
  const sw = w * sx;
  const sh = h * sy;
  const offX = anchor.offsetX * sx;
  const offY = anchor.offsetY * sy;

  let x: number;
  if (anchor.anchorX === "left") x = offX;
  else if (anchor.anchorX === "right") x = frameW - sw - offX;
  else x = Math.round(frameW / 2 - sw / 2 + offX);

  let y: number;
  if (anchor.anchorY === "top") y = offY;
  else if (anchor.anchorY === "bottom") y = frameH - sh - offY;
  else y = Math.round(frameH / 2 - sh / 2 + offY);

  return { x, y };
}

/** Posición visual de un elemento del menú escalando desde el canvas de diseño. */
export function resolveGameMenuElementPos(
  el: HubElement,
  designW: number,
  designH: number,
  frameW: number,
  frameH: number
): { x: number; y: number; width: number; height: number } {
  return minecraftDesignToFramePos(el, designW, designH, frameW, frameH);
}

function mapAction(el: HubElement): { action: GameUiElement["action"]; url?: string; server?: string } {
  const label = (el.label ?? "").toLowerCase();
  if (el.action === "join-server") {
    const server = el.serverAddress?.trim();
    return { action: "join_server", ...(server ? { server } : {}) };
  }
  if (el.action === "external" && el.externalUrl) return { action: "url", url: el.externalUrl };
  if (el.action === "play") return { action: "singleplayer" };
  if (el.action === "settings") return { action: "options" };
  if (el.action === "mods") return { action: "mods" };
  if (label.includes("single")) return { action: "singleplayer" };
  if (label.includes("multi")) return { action: "multiplayer" };
  if (label.includes("option") || label.includes("opcion") || label.includes("ajuste")) return { action: "options" };
  if (label.includes("mod")) return { action: "mods" };
  if (label.includes("quit") || label.includes("salir")) return { action: "quit" };
  if (el.externalUrl) return { action: "url", url: el.externalUrl };
  return { action: "none" };
}

/** Acción Minecraft inferida desde un elemento del Hub. */
export function deriveGameMenuAction(el: HubElement): {
  action: GameMenuAction;
  url?: string;
  server?: string;
} {
  return mapAction(el);
}

/** Convierte acción Minecraft a campos del HubElement. */
export function gameMenuActionToHubPatch(
  action: GameMenuAction,
  url?: string,
  server?: string
): Pick<HubElement, "action" | "externalUrl" | "serverAddress"> {
  switch (action) {
    case "singleplayer":
      return { action: "play" };
    case "options":
      return { action: "settings" };
    case "mods":
      return { action: "mods" };
    case "url":
      return { action: "external", externalUrl: url ?? "" };
    case "join_server":
      return { action: "join-server", serverAddress: server ?? "" };
    case "multiplayer":
    case "quit":
    case "none":
    default:
      return { action: "none" };
  }
}

export function isGameMenuLabelElement(el: HubElement): boolean {
  return TEXTISH.has(el.type) || WIDGET_AS_LABEL.has(el.type);
}

export function isGameMenuButtonElement(el: HubElement): boolean {
  return BUTTONISH.has(el.type);
}

export function isGameMenuPreviewOnlyElement(el: HubElement): boolean {
  return GAME_MENU_PREVIEW_ONLY.has(el.type);
}

/** Tamaño GUI escalado de Minecraft (misma fórmula que el cliente). */
export function minecraftGuiScaledSize(
  windowW: number,
  windowH: number
): { scale: number; gw: number; gh: number } {
  let scale = 1;
  while (scale * 320 < windowW && scale * 240 < windowH) {
    scale++;
  }
  return {
    scale,
    gw: Math.max(1, Math.floor(windowW / scale)),
    gh: Math.max(1, Math.floor(windowH / scale)),
  };
}

/** Escala visual editor (fuentes, bordes) respecto a la GUI de referencia. */
export function minecraftUiDisplayScale(
  windowW: number,
  windowH: number,
  displayW: number,
  displayH: number
): number {
  const { gw, gh } = minecraftGuiScaledSize(windowW, windowH);
  return (displayW / gw + displayH / gh) / 2;
}

/**
 * Posición en el canvas GUI del editor (mismas unidades que TitleScreen en Minecraft).
 */
export function minecraftElementGuiPos(
  el: HubElement,
  designW: number,
  designH: number,
  guiW: number,
  guiH: number
): { x: number; y: number; width: number; height: number } {
  return minecraftDesignToFramePos(el, designW, designH, guiW, guiH);
}

/** Puntero en canvas GUI → coordenadas de diseño (480×270). */
export function minecraftGuiToDesignPos(
  guiX: number,
  guiY: number,
  designW: number,
  designH: number,
  guiW: number,
  guiH: number
): { x: number; y: number } {
  return minecraftFrameToDesignPos(guiX, guiY, designW, designH, guiW, guiH);
}

/**
 * @deprecated Usar minecraftElementGuiPos (canvas = espacio GUI, no píxeles del monitor).
 */
export function minecraftElementDisplayPos(
  el: HubElement,
  designW: number,
  designH: number,
  windowW: number,
  windowH: number,
  displayW: number,
  displayH: number
): { x: number; y: number; width: number; height: number } {
  const { gw, gh } = minecraftGuiScaledSize(windowW, windowH);
  const gui = minecraftElementGuiPos(el, designW, designH, gw, gh);
  const sx = displayW / gw;
  const sy = displayH / gh;
  return {
    x: gui.x * sx,
    y: gui.y * sy,
    width: Math.max(1, gui.width * sx),
    height: Math.max(1, gui.height * sy),
  };
}

/** @deprecated Usar minecraftGuiToDesignPos */
export function minecraftDisplayToDesignPos(
  displayX: number,
  displayY: number,
  designW: number,
  designH: number,
  windowW: number,
  windowH: number,
  displayW: number,
  displayH: number
): { x: number; y: number } {
  const { gw, gh } = minecraftGuiScaledSize(windowW, windowH);
  const sx = displayW / gw;
  const sy = displayH / gh;
  return minecraftGuiToDesignPos(
    displayX / sx,
    displayY / sy,
    designW,
    designH,
    gw,
    gh
  );
}

/** Posición visual con anclas (editor Probar o edición Minecraft). */
export function minecraftElementRenderPos(
  el: HubElement,
  designW: number,
  designH: number,
  windowW: number,
  windowH: number,
  displayW: number,
  displayH: number
): { x: number; y: number; width: number; height: number } {
  return minecraftElementDisplayPos(el, designW, designH, windowW, windowH, displayW, displayH);
}

/** Convierte coords del marco de vista → coords de diseño (480×270) al arrastrar. */
export function minecraftFramePosToDesign(
  _el: HubElement,
  frameX: number,
  frameY: number,
  frameW: number,
  frameH: number,
  designW = GAME_MENU_W,
  designH = GAME_MENU_H
): { x: number; y: number } {
  return minecraftFrameToDesignPos(frameX, frameY, designW, designH, frameW, frameH);
}

/** Escala lineal diseño → marco (estable al editar; sin re-inferir anclas). */
export function minecraftDesignToFramePos(
  el: HubElement,
  designW: number,
  designH: number,
  frameW: number,
  frameH: number
): { x: number; y: number; width: number; height: number } {
  const sx = frameW / designW;
  const sy = frameH / designH;
  return {
    x: el.x * sx,
    y: el.y * sy,
    width: Math.max(1, el.width * sx),
    height: Math.max(1, el.height * sy),
  };
}

/** Escala lineal marco → diseño (arrastre en el editor). */
export function minecraftFrameToDesignPos(
  frameX: number,
  frameY: number,
  designW: number,
  designH: number,
  frameW: number,
  frameH: number
): { x: number; y: number } {
  return {
    x: (frameX * designW) / frameW,
    y: (frameY * designH) / frameH,
  };
}

/** Puntero en coords del canvas GUI → coords locales del elemento (diseño). */
export function minecraftPointerToDesignLocal(
  el: HubElement,
  canvasX: number,
  canvasY: number,
  designW: number,
  designH: number,
  guiW: number,
  guiH: number
): { x: number; y: number } {
  const pointer = minecraftGuiToDesignPos(canvasX, canvasY, designW, designH, guiW, guiH);
  return { x: pointer.x - el.x, y: pointer.y - el.y };
}

/** Anclas actuales del elemento en el canvas de diseño. */
export function hubElementAnchors(
  el: HubElement,
  designW = GAME_MENU_W,
  designH = GAME_MENU_H
): Anchor & { w: number; h: number } {
  const w = Math.max(1, Math.round(el.width));
  const h = Math.max(1, Math.round(el.height));
  return { ...designAnchorFromElement(el), w, h };
}

/** Aplica anclas → posición absoluta en canvas de diseño. */
export function anchorsToHubPosition(
  anchor: Anchor,
  w: number,
  h: number,
  designW = GAME_MENU_W,
  designH = GAME_MENU_H
): { x: number; y: number; width: number; height: number } {
  const { x, y } = resolveAnchorPosition(anchor, w, h, designW, designH);
  return { x, y, width: w, height: h };
}

function clamp(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}
export function lighten(hex: string | undefined, amt: number): string {
  const fallback = "#2b2e33";
  const s = (hex ?? fallback).trim().replace(/^#/, "");
  if (s.length !== 6) return fallback;
  const n = Number.parseInt(s, 16);
  if (Number.isNaN(n)) return fallback;
  const r = clamp(((n >> 16) & 0xff) + 255 * amt);
  const g = clamp(((n >> 8) & 0xff) + 255 * amt);
  const b = clamp((n & 0xff) + 255 * amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Repara pantalla del menú si fue redimensionada por error con la ventana del launcher. */
export function repairGameMenuScreen(
  screen: { id: string; width: number; height: number; elements: HubElement[]; independentCanvas?: boolean }
): { width: number; height: number; elements: HubElement[]; independentCanvas: boolean } | null {
  if (screen.id !== GAME_MENU_SCREEN_ID) return null;
  const needsRepair =
    !screen.independentCanvas ||
    screen.width !== GAME_MENU_W ||
    screen.height !== GAME_MENU_H;
  if (!needsRepair) {
    const migrated = migrateLegacyGameMenuElements(screen.elements);
    if (migrated !== screen.elements) {
      return { width: GAME_MENU_W, height: GAME_MENU_H, elements: migrated, independentCanvas: true };
    }
    return null;
  }

  const scaleX = screen.width > 0 ? GAME_MENU_W / screen.width : 1;
  const scaleY = screen.height > 0 ? GAME_MENU_H / screen.height : 1;
  const scaled = screen.elements.map((el) => ({
    ...el,
    x: Math.round(el.x * scaleX),
    y: Math.round(el.y * scaleY),
    width: Math.max(1, Math.round(el.width * scaleX)),
    height: Math.max(1, Math.round(el.height * scaleY)),
  }));

  return {
    width: GAME_MENU_W,
    height: GAME_MENU_H,
    elements: migrateLegacyGameMenuElements(scaled),
    independentCanvas: true,
  };
}

/** Convierte la pantalla del menú (elementos del Hub) al JSON que consume Minecraft. */
export function exportGameUi(layout: HubLayout): GameUiExport {
  const screen = layout.screens.find((s) => s.id === GAME_MENU_SCREEN_ID);
  const src = screen?.elements ?? [];
  const designW = screen?.width ?? GAME_MENU_W;
  const designH = screen?.height ?? GAME_MENU_H;
  const elements: GameUiElement[] = [];

  for (const el of src) {
    if (el.visible === false) continue;
    if (GAME_MENU_PREVIEW_ONLY.has(el.type)) continue;

    const isText = TEXTISH.has(el.type) || WIDGET_AS_LABEL.has(el.type);
    if (!isText && !BUTTONISH.has(el.type)) continue;

    const w = Math.max(1, Math.round(el.width));
    const h = Math.max(1, Math.round(el.height));
    const a = designAnchorFromElement(el);
    const colors = gameMenuExportColors(el);
    const act = mapAction(el);
    const binding = el.style?.gameMenuBinding as GameMenuBinding | undefined;

    elements.push({
      type: isText ? "label" : "button",
      text: el.label ?? "",
      ...(binding ? { binding } : {}),
      x: a.offsetX,
      y: a.offsetY,
      anchorX: a.anchorX,
      anchorY: a.anchorY,
      offsetX: a.offsetX,
      offsetY: a.offsetY,
      w,
      h,
      action: act.action,
      url: act.url,
      server: act.server,
      bg: colors.bg,
      bgHover: colors.bgHover,
      border: colors.border,
      textColor: colors.textColor,
    });
  }

  const targetWindow = detectPrimaryDisplaySize();

  const { ui } = normalizeGameUi(
    {
      schema: 2,
      designWidth: designW,
      designHeight: designH,
      targetWindowWidth: targetWindow.width,
      targetWindowHeight: targetWindow.height,
      hideVanillaDecor: true,
      elements,
    },
    targetWindow
  );

  return ui as GameUiExport;
}
