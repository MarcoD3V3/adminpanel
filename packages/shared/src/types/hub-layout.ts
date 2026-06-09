/** Contrato compartido: admin (Hub Builder) ↔ launcher desktop */

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
  | "chrome-launch-progress";

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
  /** Cualquier clic en un elemento clickable de la pantalla activa. */
  | "any-click"
  /** Cambió la fase de lanzamiento (descarga / en juego / cerrado…). */
  | "phase-change"
  /** Minecraft no está lanzándose (idle o cerrado). */
  | "launch-idle"
  /** Descarga / preparación Forge (sin estar aún en juego). */
  | "launch-active"
  /** Minecraft en ejecución. */
  | "launch-running"
  /** Falló el lanzamiento. */
  | "launch-error"
  /** El juego terminó o se cerró la sesión de lanzamiento. */
  | "launch-ended"
  /** Cambió un selector (perfil, versión, dropdown del hub). */
  | "selector-change";

export type HubScriptMode = "simple" | "hub";

export type HubContentAlign = "start" | "center" | "end";

export type HubSurfacePreset =
  | "custom"
  | "glass"
  | "frosted"
  | "solid"
  | "outline"
  | "elevated"
  | "soft";

export type HubSurfaceBlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "soft-light"
  | "lighten"
  | "darken";

export type HubSurfaceBorderStyle = "none" | "solid" | "dashed" | "dotted";

/** Efectos visuales del contenedor universal (`surface-box`). */
export interface HubSurfaceBoxOptions {
  preset?: HubSurfacePreset;
  /** Desenfoque del fondo detrás (backdrop-filter). */
  backdropBlur?: number;
  /** Saturación del fondo detrás (100 = normal). */
  backdropSaturate?: number;
  /** Opacidad del color de fondo (0–100). */
  backgroundOpacity?: number;
  borderWidth?: number;
  borderColor?: string;
  borderStyle?: HubSurfaceBorderStyle;
  shadowX?: number;
  shadowY?: number;
  shadowBlur?: number;
  shadowSpread?: number;
  shadowColor?: string;
  /** Recorta hijos al radio del contenedor. */
  clipContent?: boolean;
  blendMode?: HubSurfaceBlendMode;
}

export interface HubElementStyle {
  backgroundColor?: string;
  textColor?: string;
  borderRadius?: number;
  fontSize?: number;
  fontWeight?: "normal" | "medium" | "bold";
  /** Posición horizontal del contenido dentro del elemento. */
  contentAlignX?: HubContentAlign;
  /** Posición vertical del contenido dentro del elemento. */
  contentAlignY?: HubContentAlign;
  /**
   * Texto dinámico del menú MC (Forge, logo, contador de mods…).
   * Si está definido, el juego sustituye el label por el valor en runtime.
   */
  gameMenuBinding?: string;
}

export interface HubElementLogic {
  enabled: boolean;
  trigger: LogicTrigger;
  script: string;
  scriptMode?: HubScriptMode;
  refId?: string;
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
  targetScreenId?: string;
  visible: boolean;
  locked: boolean;
  style: HubElementStyle;
  /**
   * CSS “raw” opcional (vacío por defecto). Solo se aplican las propiedades que agregues.
   * Guardado como strings/números para que sea JSON-safe.
   */
  css?: Record<string, string | number>;
  /** Texto completo del editor CSS avanzado (incluye bloques anidados para hijos). */
  cssRaw?: string;
  /** Reglas parseadas para hijos directos (selector → propiedades). */
  cssChildRules?: Record<string, Record<string, string | number>>;
  /** Pseudos en hijos desde CSS del padre (token → pseudo → propiedades). */
  cssChildPseudo?: Record<string, Record<string, Record<string, string | number>>>;
  /** Pseudos del propio elemento (&:hover, etc.). */
  cssSelfPseudo?: Record<string, Record<string, string | number>>;
  logic?: HubElementLogic;
  /**
   * Clase/grupo del canvas: varios elementos pueden compartirlo.
   * En reglas de visibilidad usa `@group:nombre` (ej. `@group:lanzamiento`).
   */
  hubGroup?: string;
  /**
   * Clase de posición: elementos con el mismo valor comparten geometría, estilos y apariencia
   * en la misma superficie (barra o contenido). Vacío por defecto.
   */
  positionClass?: string;
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
  /** Solo para type === "surface-box". Blur, borde, sombra y presets de superficie. */
  surface?: HubSurfaceBoxOptions;
}

export interface HubScreen {
  id: string;
  name: string;
  width: number;
  height: number;
  backgroundColor: string;
  backgroundImage?: string;
  /** cover | contain | stretch | repeat */
  backgroundImageFit?: "cover" | "contain" | "stretch" | "repeat";
  /** Posición CSS del fondo (p. ej. center, top left). */
  backgroundImagePosition?: string;
  /**
   * Cómo integra la barra superior el fondo de la ventana.
   * `solid` = barra con color propio (comportamiento clásico).
   */
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
  /** Desenfoque (px) cuando `backgroundChromeStyle` es `blur`. */
  backgroundChromeBlur?: number;
  /** Opacidad del velo (0–100) para blur, tint y gradient. */
  backgroundChromeOpacity?: number;
  /** Si true, la ventana permite scroll vertical y NO auto-fit. */
  scroll?: boolean;
  /** Si true, el tamaño no se sincroniza con layout.window (p. ej. menú Minecraft). */
  independentCanvas?: boolean;
  /**
   * Si true, al usar «Ir a ventana» se abre en una ventana Electron aparte
   * (no cambia la pantalla del launcher principal).
   */
  desktopWindow?: boolean;
  /** Barra superior propia de esta ventana (tabs, buscador, controles ventana…). */
  chrome?: LauncherChromeLayout;
  elements: HubElement[];
}

/** Ventana secundaria de cuenta (pestañas Inicio / Ventana juego / Ajustes). */
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
    /** Ventana sin bordes al tamaño del monitor (área útil); se detecta en cada PC. */
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
    /** Ventana que abre el launcher al iniciar (clic derecho en pestaña → establecer principal). */
    homeScreenId?: string;
    /** Scroll suave (solo scroll vertical). */
    smoothScroll?: boolean;
    /**
     * Si true, abre una ventana de escritorio aparte al lanzar (progreso/log).
     * Por defecto false: el juego arranca igual; solo los elementos del Hub muestran estado.
     */
    launchDesktopWindow?: boolean;
    /** Ventana que abre la acción Perfil / Cuenta (p. ej. screen-profile). */
    accountScreenId?: string;
  };
  /** Layout editable desde Hub Builder para la ventana de cuenta. */
  accountSurface?: HubSurfaceLayout;
  /** Barra superior del launcher (título, cuenta, sync, ventana). */
  launcherChrome?: LauncherChromeLayout;
}

export interface LauncherChromeLayout {
  width: number;
  height: number;
  backgroundColor?: string;
  elements: HubElement[];
}
