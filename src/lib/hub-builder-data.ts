import type {
  HubElement,
  HubElementLogic,
  HubElementStyle,
  HubElementType,
  HubLayout,
  PaletteCategory,
  PaletteItem,
} from "@/types/hub-builder";
import {
  clampElement,
  defaultAccountSurface,
  fitScreenElementsToBounds,
  MIN_ELEMENT_HEIGHT,
  MIN_ELEMENT_WIDTH,
} from "@craftlauncher/shared";

export const paletteCategoryLabels: Record<PaletteCategory, string> = {
  chrome: "Barra superior",
  basic: "Básicos",
  content: "Contenido",
  layout: "Layout",
  logic: "Lógica",
  settings: "Ajustes",
  mods: "Mods",
  instances: "Perfiles / Instancias",
  account: "Cuenta / Sesión",
  launch: "Descarga / Lanzamiento",
};

export const LOGIC_ELEMENT_TYPES = new Set<HubElementType>([
  "script-button",
  "toggle",
  "input-field",
  "slider",
  "checkbox",
  "dropdown",
  "api-call",
  "timer",
  "counter",
  "toast-trigger",
  "automation-node",
  "show-on-condition",
  "hide-on-condition",
  "show-on-click",
  "toggle-visible",
  "visibility-zone",
  "minecraft-status-chip",
  "action-chip",
  "panel-visibility-select",
  "play-show-bind",
]);

export const DEFAULT_SCRIPTS: Partial<Record<HubElementType, string>> = {
  "script-button": `// ref: ctx.ref | constantes: @MSG
ctx.log("Ref:", ctx.ref);

if (@MSG) {
  toast(@MSG ?? "Acción OK");
}`,
  toggle: `const max = @MAX_TOGGLES ?? 5;
const count = ctx.inc("toggles");

if (count > max) {
  ctx.log("Límite alcanzado:", max);
} else {
  ctx.setValue(ctx.ref, count % 2 === 0);
  ctx.log("Toggle #" + count);
}`,
  "input-field": `const minLen = @MIN_LEN ?? 3;
const val = String(ctx.element.value ?? "");

ctx.assert(val.length >= minLen, "Mínimo " + minLen + " caracteres");
ctx.setGlobal("lastInput", val);`,
  slider: `const val = ctx.toNumber(ctx.element.value, 50);
const min = @MIN ?? 0;
const max = @MAX ?? 100;

ctx.assert(val >= min && val <= max, "Fuera de rango");
ctx.setState("slider", val);`,
  checkbox: `const required = @REQUIRED ?? true;
const checked = !Boolean(ctx.element.value);

if (required) ctx.assert(checked, "Debes aceptar para continuar");
ctx.setState("checked", checked);`,
  dropdown: `const allowed = String(@OPTIONS ?? "a,b,c").split(",");
const pick = String(ctx.element.value ?? allowed[0]);

ctx.verify(allowed.includes(pick), "Opción válida", "Opción no permitida");
ctx.setGlobal("selectedOption", pick);`,
  "api-call": `const url = String(@API_URL ?? ctx.element.logic?.apiUrl ?? "");
ctx.assert(url, "Define API_URL en constantes");

const method = String(@METHOD ?? ctx.element.logic?.apiMethod ?? "POST");
const res = await ctx.api(url, { method });
ctx.verify(res.status === 200, "API OK", "API error: " + res.status);`,
  timer: `const maxSec = @MAX_SEC ?? 60;
const t = ctx.inc("seconds");

if (t > maxSec) {
  ctx.setState("seconds", 0);
  ctx.updateElement({ label: "00:00" });
} else {
  ctx.updateElement({ label: String(t).padStart(2, "0") + ":00" });
}`,
  counter: `const max = @MAX ?? 99;
const step = @STEP ?? 1;
const n = ctx.inc("count", step);

if (n > max) {
  ctx.setState("count", max);
  ctx.updateElement({ label: String(max), value: max });
  toast("Máximo " + max);
} else {
  ctx.updateElement({ label: String(n), value: n });
}`,
  "toast-trigger": `toast(@MSG ?? ctx.element.label, String(@TYPE ?? "info"));`,
  "show-on-click": `// Constantes: SHOW = refId a mostrar, HIDE = refId a ocultar (opcional)
const show = String(@SHOW ?? @TARGET ?? "").trim();
const hide = String(@HIDE ?? "").trim();
if (show && ctx.exists(show)) ctx.show(show);
if (hide && ctx.exists(hide)) ctx.hide(hide);`,
  "toggle-visible": `const t = String(@TARGET ?? ctx.ref).trim();
if (t && ctx.exists(t)) ctx.toggleVisible(t);`,
  "action-chip": `// Acción al clic — edita el script
ctx.log("Clic:", ctx.ref);`,
  "panel-visibility-select": "",
  "play-show-bind": "",
  "automation-node": `// Disparador: launch-ended, launch-running, phase-change…
if (ctx.isLaunchIdle()) {
  ctx.show("btnJugar");
  ctx.hide("panelDescarga");
}`,
  "minecraft-status-chip": "",
  "visibility-zone": "",
};

export function defaultConstantsFor(type: HubElementType): Record<string, string | number | boolean> {
  switch (type) {
    case "counter":
      return { MAX: 99, STEP: 1 };
    case "script-button":
      return { MSG: "Ejecutado" };
    case "timer":
      return { MAX_SEC: 60 };
    case "input-field":
      return { MIN_LEN: 3 };
    case "slider":
      return { MIN: 0, MAX: 100 };
    case "api-call":
      return { METHOD: "POST", API_URL: "https://api.example.com/webhook" };
    case "toast-trigger":
      return { MSG: "Notificación", TYPE: "info" };
    case "toggle":
      return { MAX_TOGGLES: 5 };
    case "checkbox":
      return { REQUIRED: true };
    case "dropdown":
      return { OPTIONS: "a,b,c" };
    default:
      return {};
  }
}

export function defaultElementLogic(type: HubElementType): HubElementLogic | undefined {
  if (!LOGIC_ELEMENT_TYPES.has(type)) return undefined;
  if (
    type === "minecraft-status-chip" ||
    type === "visibility-zone" ||
    type === "panel-visibility-select" ||
    type === "show-on-condition" ||
    type === "hide-on-condition"
  )
    return undefined;
  if (type === "play-show-bind") {
    return {
      enabled: true,
      trigger: "click",
      refId: "btn.jugarPanel",
      script: "",
      constants: { SHOW: "panelLanzando", HIDE: "" },
    };
  }

  const script = DEFAULT_SCRIPTS[type] ?? 'ctx.log("Script ejecutado", ctx.ref);';

  return {
    enabled: true,
    trigger:
      type === "timer"
        ? "interval"
        : type === "input-field"
          ? "submit"
          : type === "slider" || type === "toggle" || type === "checkbox" || type === "dropdown"
            ? "change"
            : "click",
    script,
    constants: defaultConstantsFor(type),
    intervalMs: type === "timer" ? 1000 : undefined,
    apiUrl: type === "api-call" ? "https://api.example.com/webhook" : undefined,
    apiMethod: type === "api-call" ? "POST" : undefined,
    stateKey: type === "counter" ? "count" : undefined,
  };
}

export const defaultHubLayout: HubLayout = {
  id: "hub-default",
  name: "Hub principal",
  version: 1,
  activeScreenId: "screen-home",
  updatedAt: new Date().toISOString(),
  window: { width: 980, height: 520 },
  screens: [
    {
      id: "screen-home",
      name: "Inicio",
      width: 980,
      height: 480,
      backgroundColor: "#0c0e11",
      backgroundImage: "",
      elements: [],
    },
    {
      id: "screen-profile",
      name: "Perfil",
      width: 980,
      height: 480,
      backgroundColor: "#0c0e11",
      backgroundImage: "",
      desktopWindow: true,
      elements: [],
    },
  ],
  ui: { homeScreenId: "screen-home", accountScreenId: "screen-profile" },
  accountSurface: defaultAccountSurface,
};

const TEXT_ELEMENT_TYPES = new Set<HubElementType>([
  "text",
  "button",
  "play-button",
  "nav-item",
  "banner",
  "news-card",
  "modpack-slot",
  "version-selector",
  "instance-selector",
  "installed-version-selector",
  "profile-widget",
  "icon-button",
  "link",
  "chip",
  "stat-card",
  "script-button",
  "input-field",
  "checkbox",
  "dropdown",
  "api-call",
  "timer",
  "counter",
  "toast-trigger",
]);

export function defaultElementStyle(type: HubElementType): HubElementStyle {
  if (type === "spacer") return { borderRadius: 10 };
  if (type === "image") return { borderRadius: 12 };
  if (type === "divider") return { borderRadius: 0 };

  const style: HubElementStyle = { borderRadius: 10 };

  if (TEXT_ELEMENT_TYPES.has(type)) {
    style.textColor = "#d7d8da";
  }

  switch (type) {
    case "play-button":
    case "script-button":
      style.backgroundColor = "#496f4f";
      style.fontSize = 14;
      style.fontWeight = "medium";
      break;
    case "text":
      style.fontWeight = "medium";
      style.fontSize = 14;
      break;
    case "banner":
      style.backgroundColor = "#14161a";
      style.borderRadius = 14;
      break;
    case "chip":
      style.backgroundColor = "#1a231c";
      style.fontSize = 11;
      style.borderRadius = 999;
      break;
    case "version-selector":
    case "instance-selector":
    case "installed-version-selector":
      style.backgroundColor = "#1a1d22";
      style.borderRadius = 999;
      style.fontSize = 12;
      break;
    case "launch-panel":
      style.backgroundColor = "#0c0e11";
      style.borderRadius = 16;
      break;
    case "launch-dismiss-button":
      style.backgroundColor = "rgba(255,255,255,0.08)";
      style.fontWeight = "medium";
      break;
    case "launch-desktop-window-toggle":
      style.backgroundColor = "#14161a";
      style.fontSize = 12;
      break;
    case "show-on-click":
    case "action-chip":
      style.backgroundColor = "#2a3d4a";
      style.fontWeight = "medium";
      break;
    case "toggle-visible":
      style.backgroundColor = "#1a1d22";
      break;
    case "minecraft-status-chip":
      style.backgroundColor = "#14161a";
      style.borderRadius = 999;
      style.fontSize = 12;
      break;
    case "visibility-zone":
      style.backgroundColor = "rgba(12,14,17,0.5)";
      style.borderRadius = 12;
      break;
    case "automation-node":
      style.backgroundColor = "rgba(90,120,200,0.15)";
      style.fontSize = 10;
      break;
    case "panel-visibility-select":
      style.backgroundColor = "#1a1d22";
      style.borderRadius = 999;
      style.fontSize = 12;
      break;
    case "play-show-bind":
      style.backgroundColor = "#496f4f";
      style.fontWeight = "medium";
      break;
    case "stat-card":
      style.backgroundColor = "#14161a";
      style.borderRadius = 12;
      break;
    case "container":
      style.borderRadius = 12;
      break;
    case "surface-box":
      style.backgroundColor = "rgba(255,255,255,0.03)";
      style.borderRadius = 12;
      break;
    case "icon-button":
    case "toast-trigger":
      style.backgroundColor = "#14161a";
      break;
    case "link":
      style.fontSize = 13;
      break;
    case "api-call":
      style.backgroundColor = "#1a231c";
      style.fontSize = 12;
      break;
    case "counter":
      style.backgroundColor = "#14161a";
      style.fontSize = 18;
      style.fontWeight = "medium";
      break;
    case "timer":
      style.fontSize = 16;
      style.fontWeight = "medium";
      break;
    default:
      break;
  }

  return style;
}

export const elementPalette: PaletteItem[] = [
  // Barra superior del launcher
  {
    id: "chrome.brand",
    type: "chrome-brand",
    label: "Marca",
    description: "Nombre CraftLauncher",
    category: "chrome",
    defaultWidth: 92,
    defaultHeight: 18,
    defaultLabel: "CraftLauncher",
    defaultAction: "none",
  },
  {
    id: "chrome.screenTitle",
    type: "chrome-screen-title",
    label: "Ventana actual",
    description: "Nombre de la pantalla activa (automático)",
    category: "chrome",
    defaultWidth: 120,
    defaultHeight: 20,
    defaultLabel: "Ventana",
    defaultAction: "none",
  },
  {
    id: "chrome.status",
    type: "chrome-status",
    label: "Estado sync",
    description: "Sync / conexión / lanzamiento",
    category: "chrome",
    defaultWidth: 80,
    defaultHeight: 16,
    defaultLabel: "",
    defaultAction: "none",
  },
  {
    id: "chrome.account",
    type: "chrome-account",
    label: "Cuenta",
    description: "Usuario y ventana de cuenta",
    category: "chrome",
    defaultWidth: 100,
    defaultHeight: 28,
    defaultLabel: "Cuenta",
    defaultAction: "profile",
  },
  {
    id: "chrome.launchLog",
    type: "chrome-launch-progress",
    label: "Log lanzamiento",
    description: "Opcional: chip manual; acción por defecto ninguna (tú eliges en propiedades)",
    category: "chrome",
    defaultWidth: 110,
    defaultHeight: 24,
    defaultLabel: "",
    defaultAction: "none",
  },
  {
    id: "chrome.syncBtn",
    type: "chrome-icon-button",
    label: "Sync",
    description: "Botón sincronizar",
    category: "chrome",
    defaultWidth: 28,
    defaultHeight: 28,
    defaultLabel: "Sincronizar",
    defaultAction: "sync-layout",
  },
  {
    id: "chrome.minimize",
    type: "chrome-icon-button",
    label: "Minimizar",
    description: "Minimizar ventana",
    category: "chrome",
    defaultWidth: 28,
    defaultHeight: 28,
    defaultLabel: "Minimizar",
    defaultAction: "minimize-window",
  },
  {
    id: "chrome.close",
    type: "chrome-icon-button",
    label: "Cerrar",
    description: "Cerrar launcher",
    category: "chrome",
    defaultWidth: 28,
    defaultHeight: 28,
    defaultLabel: "Cerrar",
    defaultAction: "close-window",
  },
  {
    id: "chrome.button",
    type: "chrome-button",
    label: "Botón barra",
    description: "Botón personalizable",
    category: "chrome",
    defaultWidth: 90,
    defaultHeight: 28,
    defaultLabel: "Acción",
    defaultAction: "none",
  },
  {
    id: "chrome.spacer",
    type: "chrome-spacer",
    label: "Espacio",
    description: "Separador vacío",
    category: "chrome",
    defaultWidth: 40,
    defaultHeight: 40,
    defaultLabel: "",
    defaultAction: "none",
  },
  {
    id: "chrome.divider",
    type: "chrome-divider",
    label: "Divisor",
    description: "Línea vertical",
    category: "chrome",
    defaultWidth: 1,
    defaultHeight: 24,
    defaultLabel: "",
    defaultAction: "none",
  },
  {
    id: "chrome.modsSearch",
    type: "mods-search",
    label: "Buscar mods",
    description: "Buscador del catálogo (visible solo en ventanas que elijas)",
    category: "chrome",
    chromeTarget: true,
    defaultWidth: 280,
    defaultHeight: 32,
    defaultLabel: "Buscar mods…",
    defaultAction: "none",
  },
  {
    id: "chrome.inputSearch",
    type: "input-field",
    label: "Campo búsqueda",
    description: "Input de texto / búsqueda en la barra",
    category: "chrome",
    chromeTarget: true,
    defaultWidth: 200,
    defaultHeight: 28,
    defaultLabel: "Buscar…",
    defaultAction: "none",
  },
  {
    id: "chrome.modsTabs",
    type: "mods-tabs",
    label: "Tabs mods",
    description: "Pestañas Mods / Modpacks / Texturas",
    category: "chrome",
    chromeTarget: true,
    defaultWidth: 300,
    defaultHeight: 28,
    defaultLabel: "Tabs",
    defaultAction: "none",
  },
  {
    id: "chrome.profileSelect",
    type: "instance-selector",
    label: "Selector perfil",
    description: "Perfil activo en la barra",
    category: "chrome",
    chromeTarget: true,
    defaultWidth: 160,
    defaultHeight: 28,
    defaultLabel: "Perfil",
    defaultAction: "none",
  },
  {
    id: "chrome.iconBtn",
    type: "icon-button",
    label: "Botón icono",
    description: "Acción compacta en la barra",
    category: "chrome",
    chromeTarget: true,
    defaultWidth: 28,
    defaultHeight: 28,
    defaultLabel: "Ajustes",
    defaultAction: "settings",
  },
  // Básicos
  { id: "basic.play", type: "play-button", label: "Jugar", description: "Botón principal", category: "basic", defaultWidth: 200, defaultHeight: 48, defaultLabel: "Jugar", defaultAction: "play" },
  { id: "basic.button", type: "button", label: "Botón", description: "Acción secundaria", category: "basic", defaultWidth: 110, defaultHeight: 36, defaultLabel: "Botón", defaultAction: "settings" },
  { id: "basic.icon", type: "icon-button", label: "Icono", description: "Botón solo icono", category: "basic", defaultWidth: 36, defaultHeight: 36, defaultLabel: "Ajustes", defaultAction: "settings" },
  { id: "basic.link", type: "link", label: "Enlace", description: "Texto con enlace", category: "basic", defaultWidth: 100, defaultHeight: 24, defaultLabel: "Ver más", defaultAction: "external" },
  { id: "basic.text", type: "text", label: "Texto", description: "Título o párrafo", category: "basic", defaultWidth: 160, defaultHeight: 28, defaultLabel: "Texto", defaultAction: "none" },
  { id: "basic.nav", type: "nav-item", label: "Nav", description: "Ítem menú lateral", category: "basic", defaultWidth: 140, defaultHeight: 36, defaultLabel: "Sección", defaultAction: "none" },
  // Contenido
  { id: "content.image", type: "image", label: "Imagen", description: "Logo o asset", category: "content", defaultWidth: 64, defaultHeight: 64, defaultLabel: "IMG", defaultAction: "none" },
  { id: "content.banner", type: "banner", label: "Banner", description: "Hero promocional", category: "content", defaultWidth: 360, defaultHeight: 100, defaultLabel: "Banner", defaultAction: "news" },
  { id: "content.news", type: "news-card", label: "Noticias", description: "Feed novedades", category: "content", defaultWidth: 280, defaultHeight: 120, defaultLabel: "Noticias", defaultAction: "news" },
  { id: "content.modpack", type: "modpack-slot", label: "Modpack", description: "Slot modpack", category: "content", defaultWidth: 140, defaultHeight: 120, defaultLabel: "Modpack", defaultAction: "mods" },
  { id: "content.profile", type: "profile-widget", label: "Perfil", description: "Widget usuario", category: "content", defaultWidth: 180, defaultHeight: 64, defaultLabel: "Usuario", defaultAction: "profile" },
  { id: "content.version", type: "version-selector", label: "Versión Forge", description: "Selector Forge (5 versiones)", category: "content", defaultWidth: 200, defaultHeight: 36, defaultLabel: "1.20.1 Forge", defaultAction: "none" },
  { id: "content.stat", type: "stat-card", label: "Stat", description: "Métrica numérica", category: "content", defaultWidth: 100, defaultHeight: 64, defaultLabel: "1.2k", defaultAction: "none" },
  { id: "content.chip", type: "chip", label: "Chip", description: "Etiqueta pill", category: "content", defaultWidth: 72, defaultHeight: 24, defaultLabel: "Nuevo", defaultAction: "none" },
  { id: "content.progress", type: "progress-bar", label: "Progreso", description: "Barra de progreso", category: "content", defaultWidth: 200, defaultHeight: 16, defaultLabel: "60%", defaultAction: "none" },
  // Layout
  { id: "layout.container", type: "container", label: "Contenedor", description: "Agrupa elementos", category: "layout", defaultWidth: 240, defaultHeight: 160, defaultLabel: "Grupo", defaultAction: "none" },
  {
    id: "layout.surfaceBox",
    type: "surface-box",
    label: "Contenedor universal",
    description: "Caja estilizable; fondo, borde, CSS y layout interno",
    category: "layout",
    defaultWidth: 240,
    defaultHeight: 160,
    defaultLabel: "",
    defaultAction: "none",
    preset: {
      container: { display: "flex", direction: "column", align: "start", justify: "start", gap: 8, padding: 12 },
      surface: {
        preset: "glass",
        backdropBlur: 14,
        backgroundOpacity: 38,
        borderWidth: 0,
        borderStyle: "none",
      },
    },
  },
  {
    id: "layout.navbar",
    type: "container",
    label: "Navbar",
    description: "Barra contenedora (puedes meter botones, texto, etc.)",
    category: "layout",
    defaultWidth: 900,
    defaultHeight: 88,
    defaultLabel: "Navbar",
    defaultAction: "none",
    preset: {
      container: { display: "flex", gap: 10, padding: 10 },
      style: { borderRadius: 14, backgroundColor: "rgba(255,255,255,0.03)", textColor: "#d7d8da" },
    },
  },
  { id: "layout.divider", type: "divider", label: "Divisor", description: "Línea separadora", category: "layout", defaultWidth: 200, defaultHeight: 2, defaultLabel: "", defaultAction: "none" },
  { id: "layout.spacer", type: "spacer", label: "Espacio", description: "Separador vacío", category: "layout", defaultWidth: 80, defaultHeight: 16, defaultLabel: "", defaultAction: "none" },
  // Lógica
  { id: "logic.script", type: "script-button", label: "Script", description: "Botón con script JS", category: "logic", defaultWidth: 120, defaultHeight: 36, defaultLabel: "Ejecutar", defaultAction: "none" },
  { id: "logic.toggle", type: "toggle", label: "Toggle", description: "Interruptor ON/OFF", category: "logic", defaultWidth: 48, defaultHeight: 28, defaultLabel: "ON", defaultAction: "none" },
  { id: "logic.input", type: "input-field", label: "Input", description: "Campo de texto", category: "logic", defaultWidth: 180, defaultHeight: 36, defaultLabel: "Escribe aquí…", defaultAction: "none" },
  { id: "logic.slider", type: "slider", label: "Slider", description: "Control deslizante", category: "logic", defaultWidth: 160, defaultHeight: 24, defaultLabel: "50", defaultAction: "none" },
  { id: "logic.checkbox", type: "checkbox", label: "Check", description: "Casilla verificación", category: "logic", defaultWidth: 140, defaultHeight: 28, defaultLabel: "Aceptar", defaultAction: "none" },
  { id: "logic.dropdown", type: "dropdown", label: "Select", description: "Lista desplegable", category: "logic", defaultWidth: 160, defaultHeight: 36, defaultLabel: "Opción A", defaultAction: "none" },
  { id: "logic.api", type: "api-call", label: "API", description: "Webhook / REST", category: "logic", defaultWidth: 100, defaultHeight: 36, defaultLabel: "Llamar API", defaultAction: "none" },
  { id: "logic.timer", type: "timer", label: "Timer", description: "Temporizador", category: "logic", defaultWidth: 80, defaultHeight: 36, defaultLabel: "00:00", defaultAction: "none" },
  { id: "logic.counter", type: "counter", label: "Contador", description: "Contador + script", category: "logic", defaultWidth: 64, defaultHeight: 48, defaultLabel: "0", defaultAction: "none" },
  { id: "logic.toast", type: "toast-trigger", label: "Toast", description: "Dispara notificación", category: "logic", defaultWidth: 36, defaultHeight: 36, defaultLabel: "🔔", defaultAction: "none" },
  {
    id: "logic.showOnCond",
    type: "show-on-condition",
    label: "Mostrar si condición",
    description: "Sin script: al cumplir el disparador, muestra el elemento elegido",
    category: "logic",
    defaultWidth: 8,
    defaultHeight: 8,
    defaultLabel: "",
    defaultAction: "none",
    preset: {
      visible: true,
      logic: {
        enabled: true,
        trigger: "launch-active",
        refId: "rule.showPanel",
        script: "",
        constants: {
          RULE_VISIBILITY: true,
          VIS_ACTIONS: '[{"op":"show","target":"panelLanzando"}]',
          SHOW_LIST: "panelLanzando",
        },
      },
    },
  },
  {
    id: "logic.hideOnCond",
    type: "hide-on-condition",
    label: "Ocultar si condición",
    description: "Sin script: al cumplir el disparador, oculta el elemento elegido",
    category: "logic",
    defaultWidth: 8,
    defaultHeight: 8,
    defaultLabel: "",
    defaultAction: "none",
    preset: {
      visible: true,
      logic: {
        enabled: true,
        trigger: "launch-idle",
        refId: "rule.hidePanel",
        script: "",
        constants: {
          RULE_VISIBILITY: true,
          VIS_ACTIONS: '[{"op":"hide","target":"panelLanzando"}]',
          HIDE_LIST: "panelLanzando",
        },
      },
    },
  },
  {
    id: "logic.automation",
    type: "automation-node",
    label: "Nodo automatización (avanzado)",
    description: "Invisible; solo si necesitas script personalizado",
    category: "logic",
    defaultWidth: 120,
    defaultHeight: 24,
    defaultLabel: "Auto",
    defaultAction: "none",
    preset: {
      visible: true,
      logic: {
        enabled: true,
        trigger: "launch-ended",
        refId: "auto.launchEnd",
        script: "",
        constants: { RULE_VISIBILITY: true, SHOW: "btnJugar", HIDE: "panelLanzando" },
      },
    },
  },
  {
    id: "logic.showOnClick",
    type: "show-on-click",
    label: "Mostrar al clic",
    description: "Muestra/oculta otros elementos por refId (SHOW / HIDE)",
    category: "logic",
    defaultWidth: 140,
    defaultHeight: 36,
    defaultLabel: "Ver panel",
    defaultAction: "none",
    preset: {
      style: { borderRadius: 10, backgroundColor: "#2a3d4a", textColor: "#e8e9eb", fontWeight: "medium" },
      logic: {
        enabled: true,
        trigger: "click",
        refId: "btn.showPanel",
        script: `const show = String(@SHOW ?? "panelDescarga").trim();
const hide = String(@HIDE ?? "").trim();
if (show && ctx.exists(show)) ctx.show(show);
if (hide && ctx.exists(hide)) ctx.hide(hide);`,
        constants: { SHOW: "panelDescarga", HIDE: "" },
      },
    },
  },
  {
    id: "logic.toggleVisible",
    type: "toggle-visible",
    label: "Alternar visible",
    description: "Clic → muestra/oculta el elemento con ref TARGET",
    category: "logic",
    defaultWidth: 140,
    defaultHeight: 36,
    defaultLabel: "Alternar",
    defaultAction: "none",
    preset: {
      style: { borderRadius: 10, backgroundColor: "#1a1d22", textColor: "#d7d8da" },
      logic: {
        enabled: true,
        trigger: "click",
        refId: "btn.toggle",
        constants: { TARGET: "panelExtra" },
        script: `const t = String(@TARGET ?? "").trim();
if (t && ctx.exists(t)) ctx.toggleVisible(t);`,
      },
    },
  },
  {
    id: "logic.visibilityZone",
    type: "visibility-zone",
    label: "Zona por fase MC",
    description: "Contenedor: hijos visibles solo si la fase coincide (value = running, idle, launching…)",
    category: "logic",
    defaultWidth: 320,
    defaultHeight: 200,
    defaultLabel: "",
    defaultAction: "none",
    preset: {
      value: "running",
      style: { borderRadius: 12, backgroundColor: "rgba(12,14,17,0.6)" },
      logic: { enabled: false, trigger: "click", script: "", constants: { PHASE: "running" } },
    },
  },
  {
    id: "logic.mcStatus",
    type: "minecraft-status-chip",
    label: "Estado Minecraft",
    description: "Chip en vivo: Listo / Descargando / En juego / Error",
    category: "logic",
    defaultWidth: 120,
    defaultHeight: 28,
    defaultLabel: "Listo",
    defaultAction: "none",
  },
  {
    id: "logic.actionChip",
    type: "action-chip",
    label: "Chip acción",
    description: "Botón compacto; lógica al clic (mostrar, toast, encadenar…)",
    category: "logic",
    defaultWidth: 100,
    defaultHeight: 32,
    defaultLabel: "Acción",
    defaultAction: "none",
    preset: {
      style: { borderRadius: 999, backgroundColor: "#496f4f", textColor: "#fff", fontSize: 12 },
      logic: { enabled: true, trigger: "click", refId: "chip.action", script: 'ctx.toast("Hecho", "success");', constants: {} },
    },
  },
  {
    id: "logic.panelSelect",
    type: "panel-visibility-select",
    label: "Selector de panel",
    description: "Lista desplegable: elige qué panel mostrar (por refId)",
    category: "logic",
    defaultWidth: 220,
    defaultHeight: 36,
    defaultLabel: "Ver panel",
    defaultAction: "none",
    preset: {
      value: "panelLanzando",
      style: { borderRadius: 999, backgroundColor: "#1a1d22", fontSize: 12, textColor: "#d7d8da" },
      logic: { enabled: false, trigger: "change", script: "", constants: { HIDE_OTHERS: false } },
    },
  },
  {
    id: "logic.playShow",
    type: "play-show-bind",
    label: "Jugar + mostrar panel",
    description: "Como Jugar pero muestra un panel elegido en propiedades (selector SHOW)",
    category: "logic",
    defaultWidth: 160,
    defaultHeight: 44,
    defaultLabel: "Jugar",
    defaultAction: "play",
    preset: {
      style: { borderRadius: 10, backgroundColor: "#496f4f", textColor: "#fff", fontWeight: "medium" },
      logic: {
        enabled: true,
        trigger: "click",
        refId: "btn.jugar",
        constants: { SHOW: "panelLanzando", HIDE: "" },
        script: "",
      },
    },
  },
  {
    id: "logic.onInstanceShow",
    type: "show-on-condition",
    label: "Mostrar al cambiar perfil",
    description: "Disparador: cambio en selector de perfil → mostrar elemento",
    category: "logic",
    defaultWidth: 8,
    defaultHeight: 8,
    defaultLabel: "",
    defaultAction: "none",
    preset: {
      visible: true,
      logic: {
        enabled: true,
        trigger: "selector-change",
        refId: "rule.onProfile",
        script: "",
        constants: { RULE_VISIBILITY: true, SELECTOR_REF: "sel.instance", SHOW: "panelLanzando" },
      },
    },
  },
  {
    id: "logic.anyClick",
    type: "automation-node",
    label: "Reacción a cualquier clic",
    description: "Script cuando se hace clic en otro elemento clickable de la pantalla",
    category: "logic",
    defaultWidth: 120,
    defaultHeight: 24,
    defaultLabel: "On any click",
    defaultAction: "none",
    preset: {
      logic: {
        enabled: true,
        trigger: "any-click",
        refId: "auto.anyClick",
        script: `ctx.log("Clic en:", ctx.clickedElement()?.label ?? "?");`,
        constants: {},
      },
    },
  },
  {
    id: "instances.createForm",
    type: "instance-create-form",
    label: "Crear perfil",
    description: "Formulario: nombre + versión + crear carpeta",
    category: "instances",
    defaultWidth: 280,
    defaultHeight: 200,
    defaultLabel: "Nuevo perfil",
    defaultAction: "none",
    preset: { style: { borderRadius: 12, backgroundColor: "#14161a" } },
  },
  {
    id: "instances.list",
    type: "instance-list",
    label: "Lista perfiles",
    description: "Todos los perfiles — activar y eliminar",
    category: "instances",
    defaultWidth: 320,
    defaultHeight: 280,
    defaultLabel: "Perfiles",
    defaultAction: "none",
    preset: { style: { borderRadius: 12, backgroundColor: "transparent" } },
  },
  {
    id: "instances.activeCard",
    type: "instance-active-card",
    label: "Perfil activo",
    description: "Muestra el perfil en uso y carpeta",
    category: "instances",
    defaultWidth: 300,
    defaultHeight: 120,
    defaultLabel: "Activo",
    defaultAction: "none",
    preset: { style: { borderRadius: 12, backgroundColor: "#1a1d22" } },
  },
  {
    id: "instances.avatar",
    type: "instance-avatar",
    label: "Avatar perfil activo",
    description: "Foto circular del perfil en uso (letra si no hay imagen)",
    category: "instances",
    defaultWidth: 48,
    defaultHeight: 48,
    defaultLabel: "Activo",
    defaultAction: "none",
    preset: {
      style: { borderRadius: 999, backgroundColor: "transparent", contentAlignX: "center", contentAlignY: "center" },
      logic: {
        enabled: false,
        trigger: "click",
        script: "",
        constants: {
          AVATAR_SIZE: "48",
        },
      },
    },
  },
  {
    id: "instances.avatarGrid",
    type: "instance-avatar-grid",
    label: "Avatares perfiles",
    description: "Todos los perfiles en grid — clic para activar",
    category: "instances",
    defaultWidth: 56,
    defaultHeight: 280,
    defaultLabel: "Perfiles",
    defaultAction: "none",
    preset: {
      style: { borderRadius: 12, backgroundColor: "transparent" },
      logic: {
        enabled: false,
        trigger: "click",
        script: "",
        constants: {
          GRID_COLUMNS: "0",
          GRID_GAP: "8",
          GRID_MIN_WIDTH: "48",
          INSTANCE_SORT: "name",
          INSTANCE_ORDER: "",
          AVATAR_SIZE: "48",
          AVATAR_LAYOUT: "column",
          AVATAR_ITEM_ALIGN: "center",
          AVATAR_DISTRIBUTE: "start",
          AVATAR_GROUP_GAP: "12",
          INSTANCE_GROUPS: "",
          HIDE_SCROLLBAR: "true",
        },
      },
    },
  },
  {
    id: "instances.nameInput",
    type: "instance-name-input",
    label: "Nombre perfil",
    description: "Campo nombre (vacío = versión)",
    category: "instances",
    defaultWidth: 220,
    defaultHeight: 36,
    defaultLabel: "Nombre",
    defaultAction: "none",
    preset: {
      style: { borderRadius: 8 },
      logic: { enabled: false, trigger: "click", script: "", refId: "instance.name", constants: {} },
    },
  },
  {
    id: "instances.versionSelect",
    type: "instance-version-select",
    label: "Versión perfil",
    description: "Selector Forge para nuevo perfil",
    category: "instances",
    defaultWidth: 200,
    defaultHeight: 36,
    defaultLabel: "1.20.1",
    defaultAction: "none",
    preset: {
      value: "1.20.1",
      style: { borderRadius: 8 },
      logic: { enabled: false, trigger: "click", script: "", refId: "instance.version", constants: {} },
    },
  },
  {
    id: "instances.profileSelector",
    type: "instance-selector",
    label: "Selector perfiles",
    description: "Pill: cambia el perfil activo (instancias creadas)",
    category: "instances",
    defaultWidth: 220,
    defaultHeight: 36,
    defaultLabel: "Perfil",
    defaultAction: "none",
    preset: {
      style: { borderRadius: 999, backgroundColor: "#1a1d22", textColor: "#d7d8da" },
      logic: { enabled: false, trigger: "click", script: "", refId: "instance.active", constants: {} },
    },
  },
  {
    id: "instances.installedVersionSelector",
    type: "installed-version-selector",
    label: "Versiones instaladas",
    description: "Pill: versiones en game/versions del perfil activo",
    category: "instances",
    defaultWidth: 220,
    defaultHeight: 36,
    defaultLabel: "1.20.1 Forge",
    defaultAction: "none",
    preset: {
      value: "1.20.1",
      style: { borderRadius: 999, backgroundColor: "#1a1d22", textColor: "#d7d8da" },
      logic: { enabled: false, trigger: "click", script: "", refId: "minecraft.installedVersion", constants: {} },
    },
  },
  {
    id: "content.installedVersionSelector",
    type: "installed-version-selector",
    label: "Versiones instaladas",
    description: "Igual que en Perfiles: lee carpetas versions/ del perfil",
    category: "content",
    defaultWidth: 220,
    defaultHeight: 36,
    defaultLabel: "1.20.1 Forge",
    defaultAction: "none",
    preset: {
      value: "1.20.1",
      style: { borderRadius: 999, backgroundColor: "#1a1d22", textColor: "#d7d8da" },
    },
  },
  {
    id: "instances.createBtn",
    type: "instance-create-button",
    label: "Botón crear",
    description: "Crea perfil con nombre + versión del borrador",
    category: "instances",
    defaultWidth: 160,
    defaultHeight: 40,
    defaultLabel: "Crear perfil",
    defaultAction: "create-instance",
    preset: {
      action: "create-instance",
      style: { borderRadius: 10, backgroundColor: "#496f4f", textColor: "#fff", fontWeight: "medium" },
      logic: {
        enabled: true,
        trigger: "click",
        refId: "instances.createBtn",
        script: `ctx.setInstanceDraft(String(ctx.val("instance.name") ?? ""), String(ctx.val("instance.version") ?? "1.20.1"));
ctx.createInstance();`,
        constants: {},
      },
    },
  },
  {
    id: "account.profile",
    type: "profile-widget",
    label: "Tarjeta cuenta",
    description: "Nombre y plan de la sesión activa",
    category: "account",
    defaultWidth: 220,
    defaultHeight: 72,
    defaultLabel: "Usuario",
    defaultAction: "profile",
    preset: {
      style: { borderRadius: 12, backgroundColor: "#14161a", textColor: "#e8e9eb" },
      logic: {
        enabled: false,
        trigger: "click",
        script: "",
        constants: { ACCOUNT_BIND: "profile" },
      },
    },
  },
  {
    id: "account.username",
    type: "text",
    label: "Usuario sesión",
    description: "Muestra el nombre con el que iniciaste sesión",
    category: "account",
    defaultWidth: 180,
    defaultHeight: 28,
    defaultLabel: "papa",
    defaultAction: "none",
    preset: {
      style: { fontSize: 14, fontWeight: "medium", textColor: "#d7d8da" },
      logic: { enabled: false, trigger: "click", script: "", constants: { ACCOUNT_BIND: "username" } },
    },
  },
  {
    id: "account.greeting",
    type: "text",
    label: "Saludo",
    description: "Hola + nombre de la cuenta",
    category: "account",
    defaultWidth: 200,
    defaultHeight: 32,
    defaultLabel: "Hola, jugador",
    defaultAction: "none",
    preset: {
      style: { fontSize: 16, fontWeight: "medium", textColor: "#e8e9eb" },
      logic: {
        enabled: false,
        trigger: "click",
        script: "",
        constants: { ACCOUNT_BIND: "display-greeting" },
      },
    },
  },
  {
    id: "account.tierChip",
    type: "chip",
    label: "Plan cuenta",
    description: "Etiqueta Free o Premium",
    category: "account",
    defaultWidth: 96,
    defaultHeight: 26,
    defaultLabel: "Free",
    defaultAction: "none",
    preset: {
      style: { borderRadius: 999, backgroundColor: "#1a231c", textColor: "#8fd89a" },
      logic: { enabled: false, trigger: "click", script: "", constants: { ACCOUNT_BIND: "tier-chip" } },
    },
  },
  {
    id: "account.sessionStat",
    type: "stat-card",
    label: "Estado sesión",
    description: "Indica si hay sesión activa",
    category: "account",
    defaultWidth: 120,
    defaultHeight: 64,
    defaultLabel: "Sesión",
    defaultAction: "none",
    preset: {
      value: "✓",
      style: { borderRadius: 10, backgroundColor: "#14161a", textColor: "#d7d8da" },
      logic: {
        enabled: false,
        trigger: "click",
        script: "",
        constants: { ACCOUNT_BIND: "session-status" },
      },
    },
  },
  {
    id: "account.logout",
    type: "button",
    label: "Cerrar sesión",
    description: "Cierra la sesión del launcher",
    category: "account",
    defaultWidth: 140,
    defaultHeight: 36,
    defaultLabel: "Cerrar sesión",
    defaultAction: "logout",
    preset: {
      style: { borderRadius: 10, backgroundColor: "#3a2020", textColor: "#f0a8a8", fontWeight: "medium" },
    },
  },
  {
    id: "account.skin",
    type: "button",
    label: "Mi skin",
    description: "Abre el panel para subir tu skin",
    category: "account",
    defaultWidth: 120,
    defaultHeight: 36,
    defaultLabel: "Mi skin",
    defaultAction: "skin",
    preset: {
      style: { borderRadius: 10, backgroundColor: "#1a2a1f", textColor: "#8fd89a", fontWeight: "medium" },
    },
  },
  {
    id: "account.settings",
    type: "icon-button",
    label: "Ajustes cuenta",
    description: "Ir a ajustes del launcher",
    category: "account",
    defaultWidth: 36,
    defaultHeight: 36,
    defaultLabel: "Ajustes",
    defaultAction: "settings",
    preset: {
      style: { borderRadius: 10, backgroundColor: "transparent", textColor: "#d7d8da" },
      logic: {
        enabled: false,
        trigger: "click",
        script: "",
        constants: { ICON_NAME: "settings" },
      },
    },
  },
  {
    id: "account.instances",
    type: "button",
    label: "Mis perfiles",
    description: "Abre el panel de perfiles MC",
    category: "account",
    defaultWidth: 130,
    defaultHeight: 36,
    defaultLabel: "Mis perfiles",
    defaultAction: "instances",
    preset: {
      style: { borderRadius: 10, backgroundColor: "#1a1d22", textColor: "#d7d8da" },
    },
  },
  {
    id: "account.sync",
    type: "button",
    label: "Actualizar hub",
    description: "Sincroniza layout con el panel admin",
    category: "account",
    defaultWidth: 150,
    defaultHeight: 34,
    defaultLabel: "Actualizar",
    defaultAction: "sync-layout",
    preset: {
      style: { borderRadius: 10, backgroundColor: "#14161a", textColor: "#8b8d92" },
    },
  },
  {
    id: "launch.panel",
    type: "launch-panel",
    label: "Panel descarga",
    description:
      "Contenedor con piezas modulares (título, fase, barra, registro, ocultar). Arrastra también cada pieza por separado.",
    category: "launch",
    defaultWidth: 400,
    defaultHeight: 380,
    defaultLabel: "Panel lanzamiento",
    defaultAction: "none",
    preset: {
      visible: false,
      hubGroup: "lanzamiento",
      style: { borderRadius: 16, backgroundColor: "#0c0e11", textColor: "#e8e9eb" },
      container: {
        display: "flex",
        direction: "column",
        align: "stretch",
        justify: "start",
        gap: 10,
        padding: 20,
        wrap: false,
      },
      logic: { enabled: false, trigger: "click", script: "", refId: "panelLanzando" },
    },
  },
  {
    id: "launch.versionTitle",
    type: "launch-version-title",
    label: "Título versión",
    description: "Nombre perfil + versión Forge en curso",
    category: "launch",
    defaultWidth: 320,
    defaultHeight: 28,
    defaultLabel: "danilo · 1.16.5 Forge",
    defaultAction: "none",
  },
  {
    id: "launch.phase",
    type: "launch-phase-label",
    label: "Estado fase",
    description: "SINCRONIZANDO, DESCARGANDO, etc. + %",
    category: "launch",
    defaultWidth: 200,
    defaultHeight: 24,
    defaultLabel: "Sincronizando",
    defaultAction: "none",
  },
  {
    id: "launch.detail",
    type: "launch-detail-text",
    label: "Detalle descarga",
    description: "Mensaje actual (assets, librerías…)",
    category: "launch",
    defaultWidth: 360,
    defaultHeight: 40,
    defaultLabel: "assets: 2293/2615",
    defaultAction: "none",
  },
  {
    id: "launch.progress",
    type: "launch-progress-bar",
    label: "Barra progreso",
    description: "Progreso real del lanzamiento",
    category: "launch",
    defaultWidth: 360,
    defaultHeight: 8,
    defaultLabel: "",
    defaultAction: "none",
  },
  {
    id: "launch.log",
    type: "launch-log-panel",
    label: "Registro",
    description: "Log colapsable del lanzamiento",
    category: "launch",
    defaultWidth: 360,
    defaultHeight: 140,
    defaultLabel: "",
    defaultAction: "none",
  },
  {
    id: "launch.hint",
    type: "launch-hint-text",
    label: "Texto ayuda",
    description: "Aviso secundario (ej. ocultar no cancela)",
    category: "launch",
    defaultWidth: 320,
    defaultHeight: 20,
    defaultLabel: "Ocultar no cancela la descarga",
    defaultAction: "none",
  },
  {
    id: "launch.dismiss",
    type: "launch-dismiss-button",
    label: "Botón ocultar",
    description: "Cierra u oculta el panel de descarga",
    category: "launch",
    defaultWidth: 360,
    defaultHeight: 44,
    defaultLabel: "Ocultar",
    defaultAction: "hide-launch-panel",
    preset: {
      style: { borderRadius: 10, backgroundColor: "rgba(255,255,255,0.08)", textColor: "#e8e9eb" },
    },
  },
  {
    id: "launch.structuredLog",
    type: "launch-structured-log",
    label: "Registro detallado",
    description: "Log con niveles (ok, error, paso) — no afecta al arranque del juego",
    category: "launch",
    defaultWidth: 360,
    defaultHeight: 160,
    defaultLabel: "",
    defaultAction: "none",
  },
  {
    id: "launch.errorBlock",
    type: "launch-error-block",
    label: "Bloque error",
    description: "Mensaje si el lanzamiento falló (solo visual)",
    category: "launch",
    defaultWidth: 360,
    defaultHeight: 48,
    defaultLabel: "",
    defaultAction: "none",
  },
  {
    id: "launch.okHint",
    type: "launch-ok-hint",
    label: "Aviso en juego",
    description: "Texto verde cuando Minecraft ya está abierto",
    category: "launch",
    defaultWidth: 360,
    defaultHeight: 28,
    defaultLabel: "",
    defaultAction: "none",
  },
  {
    id: "launch.desktopWindow",
    type: "launch-desktop-window-toggle",
    label: "Ventana escritorio",
    description: "Switch: ventana separada al lanzar (OFF por defecto; el juego arranca igual)",
    category: "launch",
    defaultWidth: 300,
    defaultHeight: 36,
    defaultLabel: "Ventana descarga separada",
    defaultAction: "none",
  },
  {
    id: "instances.scriptCreate",
    type: "script-button",
    label: "Script crear",
    description: "Crea perfil por script (ctx.createInstance)",
    category: "instances",
    defaultWidth: 140,
    defaultHeight: 36,
    defaultLabel: "Crear",
    defaultAction: "none",
    preset: {
      style: { borderRadius: 10, backgroundColor: "#2a4a35", textColor: "#fff" },
      logic: {
        enabled: true,
        trigger: "click",
        refId: "instances.scriptCreate",
        script: `const name = String(ctx.val("instance.name") ?? @NAME ?? "").trim();
const ver = String(ctx.val("instance.version") ?? @VERSION ?? "1.20.1");
ctx.createInstance(name, ver);
avisa("Perfil: " + (name || ver), "success");`,
        constants: { NAME: "", VERSION: "1.20.1" },
      },
    },
  },

  // Ajustes (presets listos para screen-settings)
  {
    id: "settings.dataDirInput",
    type: "input-field",
    label: "Ruta carpeta datos",
    description: "Input con refId settings.dataDir",
    category: "settings",
    defaultWidth: 560,
    defaultHeight: 42,
    defaultLabel: "C:\\Users\\…\\.craftlauncher",
    defaultAction: "none",
    preset: {
      logic: {
        enabled: true,
        trigger: "change",
        refId: "settings.dataDir",
        script: `ctx.setGlobal(\"dataDirDraft\", String(ctx.element.value ?? \"\"));`,
        constants: {},
      },
      style: { borderRadius: 12, textColor: "#d7d8da" },
    },
  },
  {
    id: "settings.pickDataDir",
    type: "script-button",
    label: "Explorar carpeta",
    description: "Abre selector de carpeta",
    category: "settings",
    defaultWidth: 160,
    defaultHeight: 42,
    defaultLabel: "Explorar",
    defaultAction: "none",
    preset: {
      logic: {
        enabled: true,
        trigger: "click",
        refId: "settings.pickDataDir",
        script: `ctx.emit(\"desktop\", { action: \"pickDataDir\", targetRef: \"settings.dataDir\" });`,
        constants: {},
      },
      style: { borderRadius: 12, backgroundColor: "#2a2d33", textColor: "#fff", fontWeight: "medium" },
    },
  },
  {
    id: "settings.saveDataDir",
    type: "script-button",
    label: "Guardar carpeta",
    description: "Guarda dataDir desde settings.dataDir",
    category: "settings",
    defaultWidth: 170,
    defaultHeight: 42,
    defaultLabel: "Guardar",
    defaultAction: "none",
    preset: {
      logic: {
        enabled: true,
        trigger: "click",
        refId: "settings.saveDataDir",
        script: `ctx.emit(\"desktop\", { action: \"saveDataDir\", valueRef: \"settings.dataDir\" });`,
        constants: {},
      },
      style: { borderRadius: 12, backgroundColor: "#496f4f", textColor: "#fff", fontWeight: "medium" },
    },
  },
  {
    id: "settings.themeDropdown",
    type: "dropdown",
    label: "Tema UI",
    description: "Dropdown con opciones",
    category: "settings",
    defaultWidth: 240,
    defaultHeight: 40,
    defaultLabel: "Tema: oscuro,neón,clásico",
    defaultAction: "none",
    preset: {
      value: "oscuro",
      logic: {
        enabled: true,
        trigger: "change",
        refId: "settings.theme",
        script: `ctx.toast(\"Tema: \" + String(ctx.element.value), \"info\");`,
        constants: { OPTIONS: "oscuro,neón,clásico" },
      },
      style: { borderRadius: 12, textColor: "#d7d8da" },
    },
  },
  {
    id: "settings.toggleFast",
    type: "toggle",
    label: "Toggle arranque rápido",
    description: "Toggle con refId settings.fastLaunch",
    category: "settings",
    defaultWidth: 260,
    defaultHeight: 40,
    defaultLabel: "Arranque rápido (caché)",
    defaultAction: "none",
    preset: {
      value: true,
      logic: { enabled: true, trigger: "change", refId: "settings.fastLaunch", script: `ctx.log(\"fast\", ctx.element.value);`, constants: {} },
      style: { borderRadius: 12, backgroundColor: "#1a1d22", textColor: "#d7d8da" },
    },
  },
  {
    id: "settings.toggleDebug",
    type: "toggle",
    label: "Toggle logs debug",
    description: "Toggle con refId settings.debugLogs",
    category: "settings",
    defaultWidth: 280,
    defaultHeight: 40,
    defaultLabel: "Logs detallados (debug)",
    defaultAction: "none",
    preset: {
      value: false,
      logic: { enabled: true, trigger: "change", refId: "settings.debugLogs", script: `ctx.log(\"debug\", ctx.element.value);`, constants: {} },
      style: { borderRadius: 12, backgroundColor: "#1a1d22", textColor: "#d7d8da" },
    },
  },
  {
    id: "settings.toastTest",
    type: "toast-trigger",
    label: "Probar toast",
    description: "Botón toast success",
    category: "settings",
    defaultWidth: 150,
    defaultHeight: 40,
    defaultLabel: "Probar",
    defaultAction: "none",
    preset: {
      logic: { enabled: true, trigger: "click", refId: "settings.toast", script: `ctx.toast(\"OK\", \"success\");`, constants: {} },
      style: { borderRadius: 12, backgroundColor: "#2a2d33", textColor: "#d7d8da", fontWeight: "medium" },
    },
  },
  // ---- Ajustes avanzados (más de 20 presets útiles) ----
  {
    id: "settings.ramMinSlider",
    type: "slider",
    label: "RAM mínima",
    description: "Slider (MB) con refId settings.ramMinMb",
    category: "settings",
    defaultWidth: 320,
    defaultHeight: 34,
    defaultLabel: "RAM min (MB)",
    defaultAction: "none",
    preset: {
      value: 1024,
      logic: {
        enabled: true,
        trigger: "change",
        refId: "settings.ramMinMb",
        script: `ctx.toast(\"RAM mínima: \" + String(ctx.element.value) + \" MB\", \"info\");`,
        constants: {},
      },
      style: { borderRadius: 12, backgroundColor: "#1a1d22", textColor: "#d7d8da" },
    },
  },
  {
    id: "settings.ramMaxSlider",
    type: "slider",
    label: "RAM máxima",
    description: "Slider (MB) con refId settings.ramMaxMb",
    category: "settings",
    defaultWidth: 320,
    defaultHeight: 34,
    defaultLabel: "RAM max (MB)",
    defaultAction: "none",
    preset: {
      value: 4096,
      logic: {
        enabled: true,
        trigger: "change",
        refId: "settings.ramMaxMb",
        script: `ctx.toast(\"RAM máxima: \" + String(ctx.element.value) + \" MB\", \"info\");`,
        constants: {},
      },
      style: { borderRadius: 12, backgroundColor: "#1a1d22", textColor: "#d7d8da" },
    },
  },
  {
    id: "settings.parallelDlToggle",
    type: "toggle",
    label: "Descarga paralela",
    description: "Toggle con refId settings.parallelDownloads",
    category: "settings",
    defaultWidth: 260,
    defaultHeight: 40,
    defaultLabel: "Descarga paralela",
    defaultAction: "none",
    preset: {
      value: true,
      logic: {
        enabled: true,
        trigger: "change",
        refId: "settings.parallelDownloads",
        script: `ctx.toast(\"Descarga paralela: \" + (ctx.element.value ? \"ON\" : \"OFF\"), \"info\");`,
        constants: {},
      },
      style: { borderRadius: 12, backgroundColor: "#1a1d22", textColor: "#d7d8da" },
    },
  },
  {
    id: "settings.maxSocketsSlider",
    type: "slider",
    label: "Conexiones descarga",
    description: "Slider con refId settings.maxSockets",
    category: "settings",
    defaultWidth: 280,
    defaultHeight: 34,
    defaultLabel: "Max sockets",
    defaultAction: "none",
    preset: {
      value: 24,
      logic: {
        enabled: true,
        trigger: "change",
        refId: "settings.maxSockets",
        script: `ctx.log(\"maxSockets\", ctx.element.value); ctx.toast(\"Max sockets: \" + String(ctx.element.value), \"info\");`,
        constants: {},
      },
      style: { borderRadius: 12, backgroundColor: "#1a1d22", textColor: "#d7d8da" },
    },
  },
  {
    id: "settings.fpsToggle",
    type: "checkbox",
    label: "Mostrar FPS",
    description: "Checkbox con refId settings.showFps",
    category: "settings",
    defaultWidth: 180,
    defaultHeight: 32,
    defaultLabel: "Mostrar FPS",
    defaultAction: "none",
    preset: {
      value: false,
      logic: { enabled: true, trigger: "change", refId: "settings.showFps", script: `ctx.log(\"fps\", ctx.element.value);`, constants: {} },
      style: { borderRadius: 12, textColor: "#d7d8da" },
    },
  },
  {
    id: "settings.vsyncToggle",
    type: "checkbox",
    label: "VSync",
    description: "Checkbox con refId settings.vsync",
    category: "settings",
    defaultWidth: 120,
    defaultHeight: 32,
    defaultLabel: "VSync",
    defaultAction: "none",
    preset: {
      value: true,
      logic: { enabled: true, trigger: "change", refId: "settings.vsync", script: `ctx.log(\"vsync\", ctx.element.value);`, constants: {} },
      style: { borderRadius: 12, textColor: "#d7d8da" },
    },
  },
  {
    id: "settings.fullscreenToggle",
    type: "checkbox",
    label: "Pantalla completa",
    description: "Checkbox con refId settings.fullscreen",
    category: "settings",
    defaultWidth: 220,
    defaultHeight: 32,
    defaultLabel: "Pantalla completa",
    defaultAction: "none",
    preset: {
      value: false,
      logic: { enabled: true, trigger: "change", refId: "settings.fullscreen", script: `ctx.log(\"fullscreen\", ctx.element.value);`, constants: {} },
      style: { borderRadius: 12, textColor: "#d7d8da" },
    },
  },
  {
    id: "settings.windowModeDropdown",
    type: "dropdown",
    label: "Modo ventana",
    description: "Dropdown con refId settings.windowMode",
    category: "settings",
    defaultWidth: 220,
    defaultHeight: 40,
    defaultLabel: "Ventana: normal",
    defaultAction: "none",
    preset: {
      value: "normal",
      logic: {
        enabled: true,
        trigger: "change",
        refId: "settings.windowMode",
        script: `ctx.toast(\"Modo ventana: \" + String(ctx.element.value), \"info\");`,
        constants: { OPTIONS: "normal,borderless,fullscreen" },
      },
      style: { borderRadius: 12, textColor: "#d7d8da" },
    },
  },
  {
    id: "settings.windowLockToggle",
    type: "toggle",
    label: "Bloquear tamaño ventana (migrado)",
    description: "Migrado a Propiedades del Hub → 'Ventana del launcher (fijo)'.",
    category: "settings",
    defaultWidth: 260,
    defaultHeight: 40,
    defaultLabel: "Migrado",
    defaultAction: "none",
    preset: {
      value: false,
      style: { borderRadius: 12, backgroundColor: "#1a1d22", textColor: "#d7d8da" },
    },
  },
  {
    id: "settings.windowWidthInput",
    type: "input-field",
    label: "Ancho ventana (migrado)",
    description: "Migrado a Propiedades del Hub → 'Ventana del launcher (fijo)'.",
    category: "settings",
    defaultWidth: 220,
    defaultHeight: 42,
    defaultLabel: "Migrado",
    defaultAction: "none",
    preset: {
      value: "",
      style: { borderRadius: 12, textColor: "#d7d8da" },
    },
  },
  {
    id: "settings.windowHeightInput",
    type: "input-field",
    label: "Alto ventana (migrado)",
    description: "Migrado a Propiedades del Hub → 'Ventana del launcher (fijo)'.",
    category: "settings",
    defaultWidth: 220,
    defaultHeight: 42,
    defaultLabel: "Migrado",
    defaultAction: "none",
    preset: {
      value: "",
      style: { borderRadius: 12, textColor: "#d7d8da" },
    },
  },
  {
    id: "settings.launcherThemeDropdown",
    type: "dropdown",
    label: "Tema launcher",
    description: "Dropdown con refId settings.launcherTheme",
    category: "settings",
    defaultWidth: 240,
    defaultHeight: 40,
    defaultLabel: "Launcher: dark",
    defaultAction: "none",
    preset: {
      value: "dark",
      logic: {
        enabled: true,
        trigger: "change",
        refId: "settings.launcherTheme",
        script: `ctx.toast(\"Tema launcher: \" + String(ctx.element.value), \"info\");`,
        constants: { OPTIONS: "dark,midnight,neon,classic" },
      },
      style: { borderRadius: 12, textColor: "#d7d8da" },
    },
  },
  {
    id: "settings.telemetryToggle",
    type: "toggle",
    label: "Telemetría",
    description: "Toggle con refId settings.telemetry",
    category: "settings",
    defaultWidth: 220,
    defaultHeight: 40,
    defaultLabel: "Telemetría",
    defaultAction: "none",
    preset: {
      value: false,
      logic: {
        enabled: true,
        trigger: "change",
        refId: "settings.telemetry",
        script: `ctx.toast(\"Telemetría: \" + (ctx.element.value ? \"ON\" : \"OFF\"), \"info\");`,
        constants: {},
      },
      style: { borderRadius: 12, backgroundColor: "#1a1d22", textColor: "#d7d8da" },
    },
  },
  {
    id: "settings.autoSyncToggle",
    type: "toggle",
    label: "Auto-sync",
    description: "Toggle con refId settings.autoSync",
    category: "settings",
    defaultWidth: 220,
    defaultHeight: 40,
    defaultLabel: "Auto-sync",
    defaultAction: "none",
    preset: {
      value: true,
      logic: {
        enabled: true,
        trigger: "change",
        refId: "settings.autoSync",
        script: `ctx.log(\"autosync\", ctx.element.value);`,
        constants: {},
      },
      style: { borderRadius: 12, backgroundColor: "#1a1d22", textColor: "#d7d8da" },
    },
  },
  {
    id: "settings.jvmArgsInput",
    type: "input-field",
    label: "JVM args",
    description: "Input con refId settings.jvmArgs",
    category: "settings",
    defaultWidth: 560,
    defaultHeight: 42,
    defaultLabel: "-XX:+UseG1GC ...",
    defaultAction: "none",
    preset: {
      logic: {
        enabled: true,
        trigger: "change",
        refId: "settings.jvmArgs",
        script: `ctx.setGlobal(\"jvmArgsDraft\", String(ctx.element.value ?? \"\"));`,
        constants: {},
      },
      style: { borderRadius: 12, textColor: "#d7d8da" },
    },
  },
  {
    id: "settings.javaPathInput",
    type: "input-field",
    label: "Java path",
    description: "Input con refId settings.javaPath",
    category: "settings",
    defaultWidth: 560,
    defaultHeight: 42,
    defaultLabel: "C:\\Program Files\\Java\\...",
    defaultAction: "none",
    preset: {
      logic: {
        enabled: true,
        trigger: "change",
        refId: "settings.javaPath",
        script: `ctx.toast(\"Java path actualizado\", \"info\");`,
        constants: {},
      },
      style: { borderRadius: 12, textColor: "#d7d8da" },
    },
  },
  {
    id: "settings.clearLogsBtn",
    type: "script-button",
    label: "Limpiar logs UI",
    description: "Limpia estado de logs del panel (solo UI)",
    category: "settings",
    defaultWidth: 160,
    defaultHeight: 42,
    defaultLabel: "Limpiar logs",
    defaultAction: "none",
    preset: {
      logic: {
        enabled: true,
        trigger: "click",
        refId: "settings.clearLogs",
        script: `ctx.toast(\"Logs limpiados (UI)\", \"success\");`,
        constants: {},
      },
      style: { borderRadius: 12, backgroundColor: "#2a2d33", textColor: "#fff", fontWeight: "medium" },
    },
  },
  {
    id: "settings.runSelfCheckBtn",
    type: "script-button",
    label: "Self-check",
    description: "Chequeo rápido de valores típicos",
    category: "settings",
    defaultWidth: 160,
    defaultHeight: 42,
    defaultLabel: "Self-check",
    defaultAction: "none",
    preset: {
      logic: {
        enabled: true,
        trigger: "click",
        refId: "settings.selfCheck",
        script: `ctx.toast(\"Self-check: OK\", \"success\");`,
        constants: {},
      },
      style: { borderRadius: 12, backgroundColor: "#2a2d33", textColor: "#fff", fontWeight: "medium" },
    },
  },
  {
    id: "settings.openDiscordBtn",
    type: "script-button",
    label: "Soporte (Discord)",
    description: "Muestra instrucciones de soporte",
    category: "settings",
    defaultWidth: 190,
    defaultHeight: 42,
    defaultLabel: "Soporte",
    defaultAction: "none",
    preset: {
      logic: {
        enabled: true,
        trigger: "click",
        refId: "settings.support",
        script: `ctx.toast(\"Soporte: abre el panel de ayuda (pendiente)\", \"info\");`,
        constants: {},
      },
      style: { borderRadius: 12, backgroundColor: "#2a2d33", textColor: "#fff", fontWeight: "medium" },
    },
  },
  {
    id: "settings.quickNavModsBtn",
    type: "button",
    label: "Abrir mods",
    description: "Botón con acción mods",
    category: "settings",
    defaultWidth: 160,
    defaultHeight: 42,
    defaultLabel: "Abrir mods",
    defaultAction: "mods",
    preset: {
      action: "mods",
      style: { borderRadius: 12, backgroundColor: "#2a2d33", textColor: "#fff", fontWeight: "medium" },
    },
  },
  {
    id: "settings.quickNavProfilesBtn",
    type: "button",
    label: "Perfiles",
    description: "Botón con acción instances",
    category: "settings",
    defaultWidth: 160,
    defaultHeight: 42,
    defaultLabel: "Perfiles",
    defaultAction: "instances",
    preset: {
      action: "instances",
      style: { borderRadius: 12, backgroundColor: "#2a2d33", textColor: "#fff", fontWeight: "medium" },
    },
  },
  {
    id: "settings.quickNavHomeBtn",
    type: "button",
    label: "Volver inicio",
    description: "Abre ventana principal via navigate",
    category: "settings",
    defaultWidth: 160,
    defaultHeight: 42,
    defaultLabel: "Inicio",
    defaultAction: "none",
    preset: {
      logic: {
        enabled: true,
        trigger: "click",
        refId: "settings.goHome",
        script: `ctx.emit(\"navigate\", { screen: \"screen-home\" });`,
        constants: {},
      },
      style: { borderRadius: 12, backgroundColor: "#2a2d33", textColor: "#fff", fontWeight: "medium" },
    },
  },
  {
    id: "settings.sectionTitleText",
    type: "text",
    label: "Título sección",
    description: "Texto grande para separar secciones",
    category: "settings",
    defaultWidth: 280,
    defaultHeight: 32,
    defaultLabel: "Sección",
    defaultAction: "none",
    preset: {
      style: { textColor: "#ffffff", fontSize: 18, fontWeight: "bold" },
    },
  },
  {
    id: "settings.tipText",
    type: "text",
    label: "Tip (texto)",
    description: "Texto pequeño tipo hint",
    category: "settings",
    defaultWidth: 420,
    defaultHeight: 24,
    defaultLabel: "Tip: usa SSD para mejor rendimiento",
    defaultAction: "none",
    preset: {
      style: { textColor: "#a6a8ad", fontSize: 12, fontWeight: "normal" },
    },
  },
  {
    id: "settings.resetSectionBtn",
    type: "script-button",
    label: "Reset sección",
    description: "Ejemplo: resetea refs comunes de settings",
    category: "settings",
    defaultWidth: 160,
    defaultHeight: 42,
    defaultLabel: "Reset sección",
    defaultAction: "none",
    preset: {
      logic: {
        enabled: true,
        trigger: "click",
        refId: "settings.resetSection",
        script: `ctx.setValue(\"settings.fastLaunch\", false); ctx.setValue(\"settings.debugLogs\", false); ctx.toast(\"Sección reseteada\", \"success\");`,
        constants: {},
      },
      style: { borderRadius: 12, backgroundColor: "#2a2d33", textColor: "#fff", fontWeight: "medium" },
    },
  },
  {
    id: "settings.bannerInfo",
    type: "banner",
    label: "Banner info",
    description: "Banner sin imagen para avisos",
    category: "settings",
    defaultWidth: 520,
    defaultHeight: 90,
    defaultLabel: "Aviso",
    defaultAction: "none",
    preset: {
      label: "Recomendación: 4GB RAM para mods pesados",
      style: { borderRadius: 14, backgroundColor: "#15171c", textColor: "#d7d8da" },
    },
  },
  {
    id: "settings.apiPingBtn",
    type: "api-call",
    label: "Ping API",
    description: "API-call ejemplo (webhook/healthcheck)",
    category: "settings",
    defaultWidth: 140,
    defaultHeight: 42,
    defaultLabel: "Ping API",
    defaultAction: "none",
    preset: {
      style: { borderRadius: 12, backgroundColor: "#2a2d33", textColor: "#fff", fontWeight: "medium" },
      logic: {
        enabled: true,
        trigger: "click",
        refId: "settings.apiPing",
        apiUrl: "/api/hub-builder",
        apiMethod: "GET",
        script: `ctx.toast(\"Ping enviado\", \"info\");`,
        constants: {},
      },
    },
  },
  {
    id: "settings.timerAutoSave",
    type: "timer",
    label: "Timer autosave",
    description: "Timer para scripts periódicos (solo preview/admin)",
    category: "settings",
    defaultWidth: 120,
    defaultHeight: 36,
    defaultLabel: "00:00",
    defaultAction: "none",
    preset: {
      logic: {
        enabled: true,
        trigger: "interval",
        intervalMs: 60000,
        refId: "settings.autosaveTick",
        script: `ctx.log(\"autosaveTick\", new Date().toISOString());`,
        constants: {},
      },
      style: { borderRadius: 12, backgroundColor: "#1a1d22", textColor: "#d7d8da" },
    },
  },
  {
    id: "settings.counterClicks",
    type: "counter",
    label: "Contador clicks",
    description: "Counter útil para pruebas",
    category: "settings",
    defaultWidth: 100,
    defaultHeight: 56,
    defaultLabel: "0",
    defaultAction: "none",
    preset: {
      value: 0,
      logic: {
        enabled: true,
        trigger: "click",
        refId: "settings.clickCounter",
        script: `ctx.setValue(\"settings.clickCounter\", Number(ctx.element.value ?? 0) + 1);`,
        constants: {},
      },
      style: { borderRadius: 12, backgroundColor: "#1a1d22", textColor: "#d7d8da", fontWeight: "bold" },
    },
  },

  // ---- Mods (presets para crear una ventana completa de mods sin modal) ----
  {
    id: "mods.title",
    type: "text",
    label: "Título Mods",
    description: "Título grande para la ventana de mods",
    category: "mods",
    defaultWidth: 360,
    defaultHeight: 34,
    defaultLabel: "Catálogo de mods",
    defaultAction: "none",
    preset: { style: { textColor: "#ffffff", fontSize: 22, fontWeight: "bold" } },
  },
  {
    id: "mods.subtitle",
    type: "text",
    label: "Subtítulo",
    description: "Texto pequeño bajo el título",
    category: "mods",
    defaultWidth: 520,
    defaultHeight: 22,
    defaultLabel: "Busca e instala mods, modpacks y texturas.",
    defaultAction: "none",
    preset: { style: { textColor: "#a6a8ad", fontSize: 12, fontWeight: "normal" } },
  },
  {
    id: "mods.backBtn",
    type: "script-button",
    label: "Volver",
    description: "Vuelve a una pantalla (edita el screen id)",
    category: "mods",
    defaultWidth: 120,
    defaultHeight: 40,
    defaultLabel: "Volver",
    defaultAction: "none",
    preset: {
      logic: {
        enabled: true,
        trigger: "click",
        refId: "mods.back",
        script: `ctx.emit("navigate", { screen: "screen-home" });`,
        constants: {},
      },
      style: { borderRadius: 12, backgroundColor: "#2a2d33", textColor: "#fff", fontWeight: "medium" },
    },
  },
  {
    id: "mods.searchInput",
    type: "input-field",
    label: "Buscador",
    description: "Input con refId mods.query",
    category: "mods",
    defaultWidth: 520,
    defaultHeight: 42,
    defaultLabel: "Buscar…",
    defaultAction: "none",
    preset: {
      logic: {
        enabled: true,
        trigger: "change",
        refId: "mods.query",
        script: `ctx.setGlobal("modsQuery", String(ctx.element.value ?? ""));`,
        constants: {},
      },
      style: { borderRadius: 12, textColor: "#d7d8da" },
    },
  },
  {
    id: "mods.clearSearchBtn",
    type: "script-button",
    label: "Limpiar búsqueda",
    description: "Pone mods.query vacío",
    category: "mods",
    defaultWidth: 160,
    defaultHeight: 42,
    defaultLabel: "Limpiar",
    defaultAction: "none",
    preset: {
      logic: {
        enabled: true,
        trigger: "click",
        refId: "mods.clear",
        script: `ctx.setValue("mods.query", ""); ctx.toast("Búsqueda limpiada", "info");`,
        constants: {},
      },
      style: { borderRadius: 12, backgroundColor: "#2a2d33", textColor: "#fff", fontWeight: "medium" },
    },
  },
  {
    id: "mods.tabFeatured",
    type: "nav-item",
    label: "Tab Destacados",
    description: "Nav item para tabs (refId mods.tab)",
    category: "mods",
    defaultWidth: 140,
    defaultHeight: 36,
    defaultLabel: "Destacados",
    defaultAction: "none",
    preset: {
      logic: {
        enabled: true,
        trigger: "click",
        refId: "mods.tab.featured",
        script: `ctx.setGlobal("modsTab", "featured"); ctx.toast("Tab: Destacados", "info");`,
        constants: {},
      },
      style: { borderRadius: 12, backgroundColor: "#1a1d22", textColor: "#d7d8da", fontWeight: "medium" },
    },
  },
  {
    id: "mods.tabMods",
    type: "nav-item",
    label: "Tab Mods",
    description: "Nav item para tabs",
    category: "mods",
    defaultWidth: 120,
    defaultHeight: 36,
    defaultLabel: "Mods",
    defaultAction: "none",
    preset: {
      logic: {
        enabled: true,
        trigger: "click",
        refId: "mods.tab.mods",
        script: `ctx.setGlobal("modsTab", "mods"); ctx.toast("Tab: Mods", "info");`,
        constants: {},
      },
      style: { borderRadius: 12, backgroundColor: "#1a1d22", textColor: "#d7d8da", fontWeight: "medium" },
    },
  },
  {
    id: "mods.tabModpacks",
    type: "nav-item",
    label: "Tab Modpacks",
    description: "Nav item para tabs",
    category: "mods",
    defaultWidth: 140,
    defaultHeight: 36,
    defaultLabel: "Modpacks",
    defaultAction: "none",
    preset: {
      logic: {
        enabled: true,
        trigger: "click",
        refId: "mods.tab.modpacks",
        script: `ctx.setGlobal("modsTab", "modpacks"); ctx.toast("Tab: Modpacks", "info");`,
        constants: {},
      },
      style: { borderRadius: 12, backgroundColor: "#1a1d22", textColor: "#d7d8da", fontWeight: "medium" },
    },
  },
  {
    id: "mods.tabTextures",
    type: "nav-item",
    label: "Tab Texturas",
    description: "Nav item para tabs",
    category: "mods",
    defaultWidth: 140,
    defaultHeight: 36,
    defaultLabel: "Texturas",
    defaultAction: "none",
    preset: {
      logic: {
        enabled: true,
        trigger: "click",
        refId: "mods.tab.textures",
        script: `ctx.setGlobal("modsTab", "resourcepacks"); ctx.toast("Tab: Texturas", "info");`,
        constants: {},
      },
      style: { borderRadius: 12, backgroundColor: "#1a1d22", textColor: "#d7d8da", fontWeight: "medium" },
    },
  },
  {
    id: "mods.sortDropdown",
    type: "dropdown",
    label: "Ordenar",
    description: "Dropdown con refId mods.sort",
    category: "mods",
    defaultWidth: 200,
    defaultHeight: 40,
    defaultLabel: "Ordenar: popular",
    defaultAction: "none",
    preset: {
      value: "popular",
      logic: {
        enabled: true,
        trigger: "change",
        refId: "mods.sort",
        script: `ctx.setGlobal("modsSort", String(ctx.element.value));`,
        constants: { OPTIONS: "popular,descargas,actualizado,reciente" },
      },
      style: { borderRadius: 12, textColor: "#d7d8da" },
    },
  },
  {
    id: "mods.categoryDropdown",
    type: "dropdown",
    label: "Categoría",
    description: "Filtro categoría con refId mods.category",
    category: "mods",
    defaultWidth: 220,
    defaultHeight: 40,
    defaultLabel: "Categoría: todas",
    defaultAction: "none",
    preset: {
      value: "todas",
      logic: {
        enabled: true,
        trigger: "change",
        refId: "mods.category",
        script: `ctx.setGlobal("modsCategory", String(ctx.element.value));`,
        constants: { OPTIONS: "todas,performance,gui,world,technology,magic" },
      },
      style: { borderRadius: 12, textColor: "#d7d8da" },
    },
  },
  {
    id: "mods.compatibleOnly",
    type: "toggle",
    label: "Solo compatibles",
    description: "Toggle refId mods.compatibleOnly",
    category: "mods",
    defaultWidth: 220,
    defaultHeight: 40,
    defaultLabel: "Solo compatibles",
    defaultAction: "none",
    preset: {
      value: true,
      logic: {
        enabled: true,
        trigger: "change",
        refId: "mods.compatibleOnly",
        script: `ctx.setGlobal("modsCompatibleOnly", Boolean(ctx.element.value));`,
        constants: {},
      },
      style: { borderRadius: 12, backgroundColor: "#1a1d22", textColor: "#d7d8da" },
    },
  },
  {
    id: "mods.resultsCount",
    type: "chip",
    label: "Resultados chip",
    description: "Chip para mostrar conteo",
    category: "mods",
    defaultWidth: 120,
    defaultHeight: 28,
    defaultLabel: "0 resultados",
    defaultAction: "none",
    preset: { style: { borderRadius: 999, backgroundColor: "#15171c", textColor: "#d7d8da" } },
  },
  {
    id: "mods.gridContainer",
    type: "container",
    label: "Grid catálogo",
    description: "Contenedor grande para tarjetas/lista",
    category: "mods",
    defaultWidth: 640,
    defaultHeight: 360,
    defaultLabel: "Catálogo",
    defaultAction: "none",
    preset: { style: { borderRadius: 16, backgroundColor: "#0f1115", textColor: "#d7d8da" } },
  },
  {
    id: "mods.cardTemplate",
    type: "banner",
    label: "Tarjeta item (template)",
    description: "Duplica para crear tarjetas; click guarda selección en global",
    category: "mods",
    defaultWidth: 300,
    defaultHeight: 84,
    defaultLabel: "Mod / Modpack",
    defaultAction: "none",
    preset: {
      label: "Item: nombre",
      logic: {
        enabled: true,
        trigger: "click",
        refId: "mods.item",
        script: `ctx.setGlobal("modsSelected", String(ctx.element.label ?? "")); ctx.toast("Seleccionado", "info");`,
        constants: {},
      },
      style: { borderRadius: 14, backgroundColor: "#15171c", textColor: "#d7d8da" },
    },
  },
  {
    id: "mods.previewContainer",
    type: "container",
    label: "Panel preview",
    description: "Contenedor derecha para detalles",
    category: "mods",
    defaultWidth: 340,
    defaultHeight: 360,
    defaultLabel: "Preview",
    defaultAction: "none",
    preset: { style: { borderRadius: 16, backgroundColor: "#0f1115", textColor: "#d7d8da" } },
  },
  {
    id: "mods.previewImage",
    type: "image",
    label: "Imagen preview",
    description: "Imagen del item seleccionado",
    category: "mods",
    defaultWidth: 120,
    defaultHeight: 120,
    defaultLabel: "IMG",
    defaultAction: "none",
  },
  {
    id: "mods.previewName",
    type: "text",
    label: "Nombre seleccionado",
    description: "Texto grande para el nombre",
    category: "mods",
    defaultWidth: 280,
    defaultHeight: 28,
    defaultLabel: "Nombre del item",
    defaultAction: "none",
    preset: { style: { textColor: "#ffffff", fontSize: 16, fontWeight: "bold" } },
  },
  {
    id: "mods.previewDesc",
    type: "text",
    label: "Descripción",
    description: "Texto multi-línea corto",
    category: "mods",
    defaultWidth: 320,
    defaultHeight: 60,
    defaultLabel: "Descripción del item…",
    defaultAction: "none",
    preset: { style: { textColor: "#a6a8ad", fontSize: 12, fontWeight: "normal" } },
  },
  {
    id: "mods.installBtn",
    type: "script-button",
    label: "Instalar",
    description: "Botón instalar (stub; tú conectas lógica real)",
    category: "mods",
    defaultWidth: 140,
    defaultHeight: 42,
    defaultLabel: "Instalar",
    defaultAction: "none",
    preset: {
      logic: {
        enabled: true,
        trigger: "click",
        refId: "mods.install",
        script: `ctx.toast("Instalar: " + String(ctx.getGlobal("modsSelected") ?? ""), "success");`,
        constants: {},
      },
      style: { borderRadius: 12, backgroundColor: "#496f4f", textColor: "#fff", fontWeight: "medium" },
    },
  },
  {
    id: "mods.removeBtn",
    type: "script-button",
    label: "Quitar",
    description: "Botón quitar (stub)",
    category: "mods",
    defaultWidth: 140,
    defaultHeight: 42,
    defaultLabel: "Quitar",
    defaultAction: "none",
    preset: {
      logic: {
        enabled: true,
        trigger: "click",
        refId: "mods.remove",
        script: `ctx.toast("Quitar: " + String(ctx.getGlobal("modsSelected") ?? ""), "warn");`,
        constants: {},
      },
      style: { borderRadius: 12, backgroundColor: "#2a2d33", textColor: "#fff", fontWeight: "medium" },
    },
  },
  {
    id: "mods.openWebsiteBtn",
    type: "link",
    label: "Abrir web",
    description: "Link a web externa (edita la URL)",
    category: "mods",
    defaultWidth: 160,
    defaultHeight: 24,
    defaultLabel: "Abrir página",
    defaultAction: "external",
    preset: { externalUrl: "https://www.curseforge.com/minecraft" },
  },
  {
    id: "mods.downloadProgress",
    type: "progress-bar",
    label: "Progreso descarga",
    description: "Barra progreso (placeholder)",
    category: "mods",
    defaultWidth: 260,
    defaultHeight: 16,
    defaultLabel: "0%",
    defaultAction: "none",
  },
  {
    id: "mods.statusStat",
    type: "stat-card",
    label: "Stat descargas",
    description: "Tarjeta stat para números",
    category: "mods",
    defaultWidth: 140,
    defaultHeight: 64,
    defaultLabel: "123k",
    defaultAction: "none",
    preset: { label: "Descargas", style: { borderRadius: 14, backgroundColor: "#15171c", textColor: "#d7d8da" } },
  },
  {
    id: "mods.versionChip",
    type: "chip",
    label: "Chip versión",
    description: "Chip: compatibilidad / versión",
    category: "mods",
    defaultWidth: 140,
    defaultHeight: 28,
    defaultLabel: "MC 1.20.1",
    defaultAction: "none",
    preset: { style: { borderRadius: 999, backgroundColor: "#15171c", textColor: "#d7d8da" } },
  },
  {
    id: "mods.loaderDropdown",
    type: "dropdown",
    label: "Loader",
    description: "Dropdown con refId mods.loader",
    category: "mods",
    defaultWidth: 180,
    defaultHeight: 40,
    defaultLabel: "Loader: Forge",
    defaultAction: "none",
    preset: {
      value: "forge",
      logic: {
        enabled: true,
        trigger: "change",
        refId: "mods.loader",
        script: `ctx.setGlobal("modsLoader", String(ctx.element.value));`,
        constants: { OPTIONS: "forge,fabric,quilt,neoforge" },
      },
      style: { borderRadius: 12, textColor: "#d7d8da" },
    },
  },
  {
    id: "mods.fetchBtn",
    type: "api-call",
    label: "Cargar catálogo (API)",
    description: "API-call base para traer catálogo",
    category: "mods",
    defaultWidth: 200,
    defaultHeight: 42,
    defaultLabel: "Cargar",
    defaultAction: "none",
    preset: {
      logic: {
        enabled: true,
        trigger: "click",
        refId: "mods.fetch",
        apiUrl: "/api/modpacks",
        apiMethod: "GET",
        script: `ctx.toast("Fetch catálogo…", "info");`,
        constants: { API_URL: "/api/modpacks", METHOD: "GET" },
      },
      style: { borderRadius: 12, backgroundColor: "#2a2d33", textColor: "#fff", fontWeight: "medium" },
    },
  },
  {
    id: "mods.emptyStateText",
    type: "text",
    label: "Empty state",
    description: "Texto para cuando no hay resultados",
    category: "mods",
    defaultWidth: 380,
    defaultHeight: 26,
    defaultLabel: "No hay resultados. Cambia filtros o busca otra cosa.",
    defaultAction: "none",
    preset: { style: { textColor: "#a6a8ad", fontSize: 12, fontWeight: "normal" } },
  },
  {
    id: "mods.helpBanner",
    type: "banner",
    label: "Banner ayuda",
    description: "Banner informativo para tips",
    category: "mods",
    defaultWidth: 620,
    defaultHeight: 72,
    defaultLabel: "Tip",
    defaultAction: "none",
    preset: {
      label: "Tip: usa filtros de loader y versión para evitar incompatibilidades.",
      style: { borderRadius: 14, backgroundColor: "#15171c", textColor: "#d7d8da" },
    },
  },
  {
    id: "mods.catalogFull",
    type: "mods-catalog",
    label: "Catálogo Mods (Full)",
    description: "Catálogo real (buscar, tabs, preview, instalar). Úsalo como ventana completa.",
    category: "mods",
    defaultWidth: 920,
    defaultHeight: 620,
    defaultLabel: "Catálogo",
    defaultAction: "none",
    preset: {
      style: { borderRadius: 16 },
    },
  },
  {
    id: "mods.tabsHub",
    type: "mods-tabs",
    label: "Tabs (Mods)",
    description: "Tabs reales (Destacados/Mods/Modpacks/Texturas)",
    category: "mods",
    defaultWidth: 520,
    defaultHeight: 38,
    defaultLabel: "Tabs",
    defaultAction: "none",
    preset: { style: { borderRadius: 12 } },
  },
  {
    id: "mods.searchHub",
    type: "mods-search",
    label: "Buscador (Mods)",
    description: "Buscador real conectado a CurseForge",
    category: "mods",
    defaultWidth: 720,
    defaultHeight: 44,
    defaultLabel: "Buscar…",
    defaultAction: "none",
    preset: { style: { borderRadius: 12, contentAlignX: "start", contentAlignY: "start" } },
  },
  {
    id: "mods.resultsHub",
    type: "mods-results",
    label: "Resultados (Grid)",
    description: "Grid real de resultados/featured (scroll)",
    category: "mods",
    defaultWidth: 620,
    defaultHeight: 520,
    defaultLabel: "Resultados",
    defaultAction: "none",
    preset: { style: { borderRadius: 14 } },
  },
  {
    id: "mods.previewHub",
    type: "mods-preview",
    label: "Preview (Derecha)",
    description: "Panel real de vista previa + instalar",
    category: "mods",
    defaultWidth: 320,
    defaultHeight: 520,
    defaultLabel: "Preview",
    defaultAction: "none",
    preset: { style: { borderRadius: 14 } },
  },
  {
    id: "mods.installLogHub",
    type: "mods-install-log",
    label: "Log instalación",
    description: "Log real de instalación (aparece cuando instala)",
    category: "mods",
    defaultWidth: 520,
    defaultHeight: 140,
    defaultLabel: "Instalación",
    defaultAction: "none",
    preset: { style: { borderRadius: 14 } },
  },
  {
    id: "mods.installedListHub",
    type: "mods-installed-list",
    label: "Lista mods instalados",
    description: "Lista real de mods instalados del perfil activo (desktop)",
    category: "mods",
    defaultWidth: 420,
    defaultHeight: 340,
    defaultLabel: "Mods instalados",
    defaultAction: "none",
    preset: { style: { borderRadius: 14 } },
  },
  {
    id: "mods.installedSearchHub",
    type: "mods-installed-search",
    label: "Buscador mods instalados",
    description: "Mini buscador que filtra la lista de mods instalados del perfil",
    category: "mods",
    defaultWidth: 280,
    defaultHeight: 32,
    defaultLabel: "Filtrar mods instalados…",
    defaultAction: "none",
    preset: { style: { borderRadius: 10, contentAlignX: "start", contentAlignY: "start" } },
  },
];

export function getPaletteByCategory(category: PaletteCategory): PaletteItem[] {
  return elementPalette.filter((p) => p.category === category);
}

export const actionLabels: Record<string, string> = {
  "open-screen": "Ir a ventana",
  back: "Volver atrás",
  play: "Jugar (lanzar Minecraft)",
  settings: "Abrir ajustes",
  mods: "Modpacks / Mods",
  instances: "Perfiles / Instancias",
  "create-instance": "Crear perfil (borrador)",
  "select-instance": "Activar perfil (value=id)",
  "delete-instance": "Eliminar perfil (value=id)",
  news: "Noticias",
  profile: "Perfil / Cuenta",
  skin: "Mi skin",
  chat: "Chat",
  store: "Tienda",
  external: "URL externa",
  logout: "Cerrar sesión",
  "sync-layout": "Sincronizar hub",
  "minimize-window": "Minimizar ventana",
  "close-window": "Cerrar launcher",
  "open-launch-log": "Ver log de lanzamiento",
  "hide-launch-panel": "Ocultar panel descarga",
  none: "Sin acción",
};

/** Tamaño de celda para snap al mover/redimensionar. */
export const GRID_SIZE = 4;
/** Snap más fino en la barra superior (~40px de alto). */
export const LAUNCHER_CHROME_GRID_SIZE = 2;
/** Cuadrícula visual del canvas (solo guía, más fina que el snap). */
export const VISUAL_GRID_SIZE = 2;
/** Puntos más densos en la barra superior. */
export const VISUAL_CHROME_GRID_SIZE = 1;

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 1.5;
/** Zoom extra al editar la barra superior (área pequeña). */
export const ZOOM_MAX_LAUNCHER_CHROME = 4;
/** Zoom máximo al navegar a un elemento pequeño (solo enfoque, no toolbar). */
export const ZOOM_MAX_FOCUS_SCREEN = 2.75;

export function resolveGridSize(editTarget: "screen" | "launcher-chrome" = "screen"): number {
  return editTarget === "launcher-chrome" ? LAUNCHER_CHROME_GRID_SIZE : GRID_SIZE;
}

export function resolveVisualGridSize(editTarget: "screen" | "launcher-chrome" = "screen"): number {
  return editTarget === "launcher-chrome" ? VISUAL_CHROME_GRID_SIZE : VISUAL_GRID_SIZE;
}

export function resolveZoomMax(editTarget: "screen" | "launcher-chrome" = "screen"): number {
  return editTarget === "launcher-chrome" ? ZOOM_MAX_LAUNCHER_CHROME : ZOOM_MAX;
}

export function clampHubZoom(
  zoom: number,
  editTarget: "screen" | "launcher-chrome" = "screen"
): number {
  return Math.min(resolveZoomMax(editTarget), Math.max(ZOOM_MIN, zoom));
}

export function clampFocusHubZoom(
  zoom: number,
  editTarget: "screen" | "launcher-chrome" = "screen"
): number {
  const max = editTarget === "launcher-chrome" ? ZOOM_MAX_LAUNCHER_CHROME : ZOOM_MAX_FOCUS_SCREEN;
  return Math.min(max, Math.max(ZOOM_MIN, zoom));
}

/** Acerca el zoom si el elemento quedaría demasiado pequeño en pantalla. */
export function computeElementFocusZoom(args: {
  elementWidth: number;
  elementHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  currentZoom: number;
  editTarget: "screen" | "launcher-chrome";
  minVisiblePx?: number;
}): number {
  const minPx = args.minVisiblePx ?? 72;
  const w = Math.max(1, args.elementWidth);
  const h = Math.max(1, args.elementHeight);
  const cur = args.currentZoom;

  if (w * cur >= minPx && h * cur >= minPx) return cur;

  const needed = Math.max(minPx / w, minPx / h, cur);
  const capW = (args.viewportWidth * 0.55) / w;
  const capH = (args.viewportHeight * 0.55) / h;
  return clampFocusHubZoom(Math.min(needed, capW, capH), args.editTarget);
}

export function snapToGrid(value: number, grid = GRID_SIZE): number {
  return Math.round(value / grid) * grid;
}

/** Centra en un eje y elige la celda más cercana al centro real (evita desplazamientos por redondeo). */
export function snapCenterAxis(span: number, elementSize: number, grid = GRID_SIZE): number {
  const max = Math.max(0, span - elementSize);
  const ideal = (span - elementSize) / 2;
  const candidates = new Set<number>([
    Math.min(max, Math.max(0, Math.round(ideal))),
    Math.min(max, Math.max(0, snapToGrid(ideal, grid))),
    Math.min(max, Math.max(0, Math.floor(ideal / grid) * grid)),
    Math.min(max, Math.max(0, Math.ceil(ideal / grid) * grid)),
  ]);
  let best = 0;
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = Math.abs(c - ideal);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

export { clampElement, fitScreenElementsToBounds, MIN_ELEMENT_HEIGHT, MIN_ELEMENT_WIDTH };

export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export function computeResize(
  orig: { x: number; y: number; width: number; height: number },
  handle: ResizeHandle,
  pointerX: number,
  pointerY: number,
  canvasW: number,
  canvasH: number
): { x: number; y: number; width: number; height: number } {
  const right = orig.x + orig.width;
  const bottom = orig.y + orig.height;
  const px = snapToGrid(pointerX);
  const py = snapToGrid(pointerY);

  let x = orig.x;
  let y = orig.y;
  let width = orig.width;
  let height = orig.height;

  switch (handle) {
    case "se":
      width = px - orig.x;
      height = py - orig.y;
      break;
    case "sw":
      x = px;
      width = right - px;
      height = py - orig.y;
      break;
    case "ne":
      y = py;
      width = px - orig.x;
      height = bottom - py;
      break;
    case "nw":
      x = px;
      y = py;
      width = right - px;
      height = bottom - py;
      break;
    case "e":
      width = px - orig.x;
      break;
    case "w":
      x = px;
      width = right - px;
      break;
    case "s":
      height = py - orig.y;
      break;
    case "n":
      y = py;
      height = bottom - py;
      break;
  }

  return finalizeResizeBox(orig, handle, x, y, width, height, canvasW, canvasH);
}

/** Redimensiona por delta del puntero — ancla el borde opuesto al handle. */
export function computeResizeDelta(
  orig: { x: number; y: number; width: number; height: number },
  handle: ResizeHandle,
  dx: number,
  dy: number,
  canvasW: number,
  canvasH: number
): { x: number; y: number; width: number; height: number } {
  const affectsLeft = handle === "nw" || handle === "w" || handle === "sw";
  const affectsRight = handle === "ne" || handle === "e" || handle === "se";
  const affectsTop = handle === "nw" || handle === "n" || handle === "ne";
  const affectsBottom = handle === "sw" || handle === "s" || handle === "se";

  let x = orig.x;
  let y = orig.y;
  let width = orig.width;
  let height = orig.height;

  if (affectsRight) width = orig.width + dx;
  if (affectsLeft) {
    x = orig.x + dx;
    width = orig.width - dx;
  }
  if (affectsBottom) height = orig.height + dy;
  if (affectsTop) {
    y = orig.y + dy;
    height = orig.height - dy;
  }

  return finalizeResizeBox(orig, handle, x, y, width, height, canvasW, canvasH);
}

function finalizeResizeBox(
  orig: { x: number; y: number; width: number; height: number },
  handle: ResizeHandle,
  x: number,
  y: number,
  width: number,
  height: number,
  canvasW: number,
  canvasH: number
): { x: number; y: number; width: number; height: number } {
  const anchorRight = orig.x + orig.width;
  const anchorBottom = orig.y + orig.height;
  const affectsLeft = handle === "nw" || handle === "w" || handle === "sw";
  const affectsRight = handle === "ne" || handle === "e" || handle === "se";
  const affectsTop = handle === "nw" || handle === "n" || handle === "ne";
  const affectsBottom = handle === "sw" || handle === "s" || handle === "se";

  if (width < MIN_ELEMENT_WIDTH) {
    if (affectsLeft && !affectsRight) x = anchorRight - MIN_ELEMENT_WIDTH;
    width = MIN_ELEMENT_WIDTH;
  }
  if (height < MIN_ELEMENT_HEIGHT) {
    if (affectsTop && !affectsBottom) y = anchorBottom - MIN_ELEMENT_HEIGHT;
    height = MIN_ELEMENT_HEIGHT;
  }

  if (x < 0) {
    width += x;
    x = 0;
  }
  if (y < 0) {
    height += y;
    y = 0;
  }
  if (x + width > canvasW) width = Math.max(MIN_ELEMENT_WIDTH, canvasW - x);
  if (y + height > canvasH) height = Math.max(MIN_ELEMENT_HEIGHT, canvasH - y);

  width = Math.max(MIN_ELEMENT_WIDTH, width);
  height = Math.max(MIN_ELEMENT_HEIGHT, height);

  if (affectsTop && !affectsBottom) y = Math.max(0, anchorBottom - height);
  if (affectsLeft && !affectsRight) x = Math.max(0, anchorRight - width);

  return {
    x: snapToGrid(x),
    y: snapToGrid(y),
    width: Math.max(MIN_ELEMENT_WIDTH, snapToGrid(width)),
    height: Math.max(MIN_ELEMENT_HEIGHT, snapToGrid(height)),
  };
}

export const RESIZE_HANDLES: { id: ResizeHandle; className: string; cursor: string }[] = [
  { id: "nw", className: "-left-1.5 -top-1.5", cursor: "nwse-resize" },
  { id: "n", className: "left-1/2 -top-1.5 -translate-x-1/2", cursor: "ns-resize" },
  { id: "ne", className: "-right-1.5 -top-1.5", cursor: "nesw-resize" },
  { id: "e", className: "-right-1.5 top-1/2 -translate-y-1/2", cursor: "ew-resize" },
  { id: "se", className: "-right-1.5 -bottom-1.5", cursor: "nwse-resize" },
  { id: "s", className: "left-1/2 -bottom-1.5 -translate-x-1/2", cursor: "ns-resize" },
  { id: "sw", className: "-left-1.5 -bottom-1.5", cursor: "nesw-resize" },
  { id: "w", className: "-left-1.5 top-1/2 -translate-y-1/2", cursor: "ew-resize" },
];

export const LOGIC_SCRIPT_TEMPLATES: { label: string; script: string }[] = [
  {
    label: "Log con ref",
    script: 'ctx.log("Ref:", ctx.ref, "Tipo:", ctx.element.type);',
  },
  {
    label: "Usar constantes",
    script: `const max = @MAX ?? 10;
const current = ctx.inc("clicks");

if (current <= max) {
  ctx.log("OK:", current);
} else {
  ctx.log("Superaste MAX=", max);
}`,
  },
  {
    label: "Verificar y assert",
    script: `const ok = ctx.check($miInput !== undefined, "Falta miInput");
ctx.assert(ok, "Input requerido");`,
  },
  {
    label: "Condicional if",
    script: `if (~premium) {
  avisa("Modo premium");
} else {
  avisa("Modo free");
}`,
  },
  {
    label: "Controlar otro ref",
    script: `if (!ctx.exists("banner1")) {
  log("Crea un elemento con refId banner1");
} else {
  mostrar("banner1");
  label("banner1", "Visible desde " + ctx.ref);
}`,
  },
  {
    label: "Contador con límite",
    script: `const max = @MAX ?? 99;
const n = ctx.inc("n");
ctx.updateElement({ label: String(ctx.clamp(n, 0, max)), value: n });`,
  },
  {
    label: "Encadenar scripts",
    script: `log("Paso 1:", ctx.ref);
await ejecutar("otroScript");
log("Paso 2 completado");`,
  },
  {
    label: "Estado global hub",
    script: `const visits = ctx.toNumber(~visitas, 0) + 1;
ctx.setGlobal("visitas", visits);
ctx.log("Visitas totales:", visits);`,
  },
  {
    label: "Toast notificación",
    script: 'avisa(@MSG ?? "¡Hecho!", "success");',
  },
  {
    label: "Navegar pantalla",
    script: 'ctx.setScreen("screen-play");\nctx.log("Pantalla:", ctx.screen());',
  },
  {
    label: "API con verificación",
    script: `const url = String(@API_URL ?? "https://httpbin.org/get");
const res = await ctx.api(url);
ctx.verify(res.status === 200, "API OK", "Error HTTP " + res.status);`,
  },
  {
    label: "Random + clamp",
    script: `const roll = ctx.random(1, @DICE ?? 6);
ctx.log("Dado:", roll);
ctx.setGlobal("lastRoll", roll);`,
  },
  {
    label: "Ocultar / mostrar",
    script: `if (ctx.element.visible) ocultar(ctx.ref);
else mostrar(ctx.ref);`,
  },
  {
    label: "Comparar valores",
    script: `const a = $contador1;
const meta = @GOAL ?? 10;

if (a >= meta) {
  avisa("Meta alcanzada");
}`,
  },
  {
    label: "Crear perfil (borrador)",
    script: `ctx.setInstanceDraft(@NAME ?? "", @VERSION ?? "1.20.1");
ctx.createInstance();
avisa("Perfil creado", "success");`,
  },
  {
    label: "Activar perfil por id",
    script: 'ctx.selectInstance(@INSTANCE_ID ?? "principal");',
  },
  {
    label: "Eliminar perfil",
    script: 'ctx.deleteInstance(@INSTANCE_ID ?? "");',
  },
  {
    label: "Mostrar panel al clic",
    script: `const show = String(@SHOW ?? "panelDescarga").trim();
if (show && ctx.exists(show)) ctx.show(show);`,
  },
  {
    label: "Ocultar al cerrar MC",
    script: `if (ctx.isLaunchIdle()) {
  ctx.hide("panelDescarga");
  ctx.show("btnJugar");
}`,
  },
  {
    label: "Al entrar en juego",
    script: `if (ctx.isLaunchRunning()) {
  ctx.hide("btnJugar");
  ctx.show("chipEnJuego");
}`,
  },
  {
    label: "Reaccionar a cualquier clic",
    script: `const clicked = ctx.clickedElement();
if (clicked) ctx.log("Clic en", clicked.label);`,
  },
  {
    label: "Al cambiar perfil mostrar panel",
    script: `const show = String(@SHOW ?? "panelLanzando").trim();
if (show && ctx.exists(show)) ctx.show(show);`,
  },
];
