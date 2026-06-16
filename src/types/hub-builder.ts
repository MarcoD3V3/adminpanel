/** Tipos para el editor visual del hub del launcher */

export type HubElementType =
  | "play-button"
  | "button"
  | "text"
  | "image"
  | "banner"
  | "nav-item"
  | "news-card"
  | "modpack-slot"
  | "profile-widget"
  | "version-selector"
  | "mods-catalog"
  | "mods-tabs"
  | "mods-search"
  | "mods-results"
  | "mods-preview"
  | "mods-install-log"
  | "mods-installed-list"
  | "mods-installed-search"
  | "instance-create-form"
  | "instance-list"
  | "instance-active-card"
  | "instance-avatar"
  | "instance-avatar-grid"
  | "instance-name-input"
  | "instance-version-select"
  | "instance-selector"
  | "installed-version-selector"
  | "instance-create-button"
  | "launch-panel"
  | "launch-version-title"
  | "launch-phase-label"
  | "launch-detail-text"
  | "launch-progress-bar"
  | "launch-log-panel"
  | "launch-structured-log"
  | "launch-error-block"
  | "launch-ok-hint"
  | "launch-hint-text"
  | "launch-dismiss-button"
  | "launch-desktop-window-toggle"
  | "spacer"
  | "icon-button"
  | "link"
  | "divider"
  | "container"
  | "surface-box"
  | "chip"
  | "stat-card"
  | "progress-bar"
  | "script-button"
  | "toggle"
  | "input-field"
  | "slider"
  | "checkbox"
  | "dropdown"
  | "api-call"
  | "timer"
  | "counter"
  | "toast-trigger"
  | "automation-node"
  | "show-on-click"
  | "toggle-visible"
  | "visibility-zone"
  | "minecraft-status-chip"
  | "action-chip"
  | "panel-visibility-select"
  | "play-show-bind"
  | "show-on-condition"
  | "hide-on-condition"
  | "chrome-brand"
  | "chrome-screen-title"
  | "chrome-status"
  | "chrome-account"
  | "chrome-button"
  | "chrome-icon-button"
  | "chrome-spacer"
  | "chrome-divider"
  | "chrome-launch-progress"
  | "chat-bubble-toggle"
  | "chat-header"
  | "chat-panel"
  | "chat-tabs"
  | "chat-input"
  | "chat-send"
  | "chat-close"
  | "chat-resize-handle"
  | "launcher-update-banner";

export type HubElementAction =
  | "play"
  | "open-screen"
  | "back"
  | "settings"
  | "mods"
  | "news"
  | "profile"
  | "chat"
  | "store"
  | "instances"
  | "create-instance"
  | "select-instance"
  | "delete-instance"
  | "external"
  | "join-server"
  | "logout"
  | "skin"
  | "sync-layout"
  | "minimize-window"
  | "close-window"
  | "open-launch-log"
  | "hide-launch-panel"
  | "none";

export type LogicTrigger =
  | "click"
  | "change"
  | "load"
  | "interval"
  | "submit"
  | "any-click"
  | "phase-change"
  | "launch-idle"
  | "launch-active"
  | "launch-running"
  | "launch-error"
  | "launch-ended"
  | "selector-change";

export type HubScriptMode = "simple" | "hub";

export type PaletteCategory =
  | "basic"
  | "content"
  | "layout"
  | "logic"
  | "instances"
  | "account"
  | "settings"
  | "mods"
  | "launch"
  | "chrome"
  | "chat";

export interface LauncherChromeLayout {
  width: number;
  height: number;
  backgroundColor?: string;
  elements: HubElement[];
}

export type HubContentAlign = "start" | "center" | "end";

export interface HubElementStyle {
  backgroundColor?: string;
  backgroundColorHover?: string;
  borderColor?: string;
  textColor?: string;
  borderRadius?: number;
  fontSize?: number;
  fontWeight?: "normal" | "medium" | "bold";
  opacity?: number;
  contentAlignX?: HubContentAlign;
  contentAlignY?: HubContentAlign;
  /** Texto dinámico del menú MC (Forge, logo, contador de mods…). */
  gameMenuBinding?: string;
}

export interface HubElementLogic {
  enabled: boolean;
  trigger: LogicTrigger;
  script: string;
  /** simple = lenguaje legible; hub = HubScript con $ @ ~ */
  scriptMode?: HubScriptMode;
  /** ID lógico: número o nombre sin espacios (ej. playBtn, 42) */
  refId?: string;
  /** Constantes accesibles con ctx.const('CLAVE') */
  constants?: Record<string, string | number | boolean>;
  intervalMs?: number;
  apiUrl?: string;
  apiMethod?: "GET" | "POST" | "PUT" | "DELETE";
  stateKey?: string;
}

export interface HubElement {
  id: string;
  type: HubElementType;
  /** Si está dentro de un contenedor, el parentId lo referencia. */
  parentId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  label: string;
  imageUrl?: string;
  action: HubElementAction;
  externalUrl?: string;
  /** IP o dominio cuando action es join-server (ej. play.server.net:25565). */
  serverAddress?: string;
  /** Ventana destino cuando action es open-screen (o play legacy) */
  targetScreenId?: string;
  visible: boolean;
  locked: boolean;
  style: HubElementStyle;
  /**
   * CSS “raw” opcional (vacío por defecto). Solo se aplican las propiedades que agregues.
   * Guardado como strings/números para que sea JSON-safe.
   */
  css?: Record<string, string | number>;
  cssRaw?: string;
  cssChildRules?: Record<string, Record<string, string | number>>;
  cssChildPseudo?: Record<string, Record<string, Record<string, string | number>>>;
  cssSelfPseudo?: Record<string, Record<string, string | number>>;
  logic?: HubElementLogic;
  /** Clase/grupo del canvas (varios elementos → @group:nombre en reglas). */
  hubGroup?: string;
  /** Clase de posición compartida (vacío por defecto). */
  positionClass?: string;
  /** Valor interno para inputs, toggles, sliders, contadores */
  value?: string | number | boolean;
  /** Solo para type === "container" | "surface-box". */
  container?: {
    /** Modo layout interno (similar a CSS display). */
    display?: "absolute" | "flex" | "block" | "grid" | "inline-flex";
    /** Cómo se posiciona el contenedor. */
    position?: "absolute" | "fixed" | "sticky";
    /** Solo para sticky: offset top (px). */
    stickyTop?: number;
    /** Flex direction (solo para flex/inline-flex). */
    direction?: "row" | "column";
    /** Flex wrap (solo para flex/inline-flex). */
    wrap?: boolean;
    /** Align items (solo para flex/inline-flex). */
    align?: "start" | "center" | "end" | "stretch";
    /** Justify content (solo para flex/inline-flex). */
    justify?: "start" | "center" | "end" | "between" | "around" | "evenly";
    gap?: number;
    padding?: number;
  };
  /** Solo para type === "surface-box". Blur, borde, sombra y presets. */
  surface?: import("@craftlauncher/shared").HubSurfaceBoxOptions;
}

export interface HubScreen {
  id: string;
  name: string;
  width: number;
  height: number;
  backgroundColor: string;
  backgroundImage?: string;
  backgroundImageFit?: "cover" | "contain" | "stretch" | "repeat";
  backgroundImagePosition?: string;
  backgroundChromeStyle?:
    | "solid"
    | "extend"
    | "blur"
    | "transparent"
    | "tint"
    | "gradient"
    | "frosted"
    | "glass"
    | "shadow"
    | "color-tint";
  backgroundChromeBlur?: number;
  backgroundChromeOpacity?: number;
  /** Si true, la ventana permite scroll vertical y NO auto-fit. */
  scroll?: boolean;
  /** Si true, el tamaño no se sincroniza con layout.window (p. ej. menú Minecraft). */
  independentCanvas?: boolean;
  /** Abrir en ventana de escritorio al usar «Ir a ventana». */
  desktopWindow?: boolean;
  /** Barra superior propia de esta ventana. */
  chrome?: LauncherChromeLayout;
  elements: HubElement[];
}

export interface HubSurfaceLayout {
  activeScreenId: string;
  screens: HubScreen[];
}

export interface HubLayout {
  id: string;
  name: string;
  version: number;
  activeScreenId: string;
  screens: HubScreen[];
  updatedAt: string;
  /** Config global de ventana del launcher (Electron). */
  window?: {
    width?: number;
    height?: number;
    lockSize?: boolean;
    borderlessFullscreen?: boolean;
  };
  /** Preferencias globales del launcher (pantallas internas del Hub). */
  ui?: {
    /** Transición al cambiar de pantalla. */
    screenTransition?: "none" | "fade" | "slide";
    /** Duración (ms) de la transición. */
    transitionMs?: number;
    /** Reduce animaciones/efectos por rendimiento. */
    performanceMode?: boolean;
    /** Guarda/restaura la última pantalla visitada. */
    rememberLastScreen?: boolean;
    /** Ventana que abre el launcher al iniciar. */
    homeScreenId?: string;
    /** Scroll suave (solo scroll vertical). */
    smoothScroll?: boolean;
    /** Ventana de escritorio aparte al lanzar (progreso/log). */
    launchDesktopWindow?: boolean;
    /** Ventana que abre la acción Perfil / Cuenta. */
    accountScreenId?: string;
  };
  accountSurface?: HubSurfaceLayout;
  launcherChrome?: LauncherChromeLayout;
}

export interface PaletteItem {
  /** ID único en el palette (permite presets por tipo). */
  id: string;
  type: HubElementType;
  label: string;
  description: string;
  category: PaletteCategory;
  defaultWidth: number;
  defaultHeight: number;
  defaultLabel: string;
  defaultAction: HubElementAction;
  /** Si true, el elemento se añade a la barra superior (launcherChrome). */
  chromeTarget?: boolean;
  defaultExternalUrl?: string;
  defaultServerAddress?: string;
  defaultStyle?: Partial<HubElementStyle>;
  /** Preset opcional para preconfigurar lógica/style/value/refId. */
  preset?: Partial<HubElement>;
}

export interface ContextMenuState {
  open: boolean;
  x: number;
  y: number;
  target: "canvas" | "element" | "screen";
  elementId?: string;
  screenId?: string;
  canvasX?: number;
  canvasY?: number;
}

export interface ScriptLogEntry {
  id: string;
  elementId: string;
  refId?: string;
  label: string;
  success: boolean;
  message: string;
  timestamp: string;
}
