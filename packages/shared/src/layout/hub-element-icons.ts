import type { HubElement, HubElementAction } from "../types/hub-layout";

export type HubIconCategory =
  | "acciones"
  | "navegacion"
  | "ventana"
  | "comunicacion"
  | "juego"
  | "ui"
  | "medios";

export type HubIconDef = {
  id: string;
  label: string;
  category: HubIconCategory;
};

export const HUB_ICON_CATEGORY_LABELS: Record<HubIconCategory, string> = {
  acciones: "Acciones",
  navegacion: "Navegación",
  ventana: "Ventana",
  comunicacion: "Comunicación",
  juego: "Juego",
  ui: "Interfaz",
  medios: "Medios",
};

export const DEFAULT_HUB_ICON = "settings";

export const HUB_ICON_ELEMENT_TYPES = new Set([
  "icon-button",
  "chrome-icon-button",
  "toast-trigger",
]);

export const HUB_ICON_CATALOG: HubIconDef[] = [
  { id: "settings", label: "Ajustes", category: "acciones" },
  { id: "play", label: "Jugar", category: "acciones" },
  { id: "pause", label: "Pausa", category: "acciones" },
  { id: "square", label: "Detener", category: "acciones" },
  { id: "refresh-cw", label: "Actualizar", category: "acciones" },
  { id: "rotate-cw", label: "Recargar", category: "acciones" },
  { id: "download", label: "Descargar", category: "acciones" },
  { id: "upload", label: "Subir", category: "acciones" },
  { id: "save", label: "Guardar", category: "acciones" },
  { id: "trash-2", label: "Eliminar", category: "acciones" },
  { id: "plus", label: "Añadir", category: "acciones" },
  { id: "minus", label: "Menos", category: "acciones" },
  { id: "check", label: "Confirmar", category: "acciones" },
  { id: "x", label: "Cerrar", category: "acciones" },
  { id: "power", label: "Apagar", category: "acciones" },
  { id: "log-out", label: "Salir", category: "acciones" },
  { id: "log-in", label: "Entrar", category: "acciones" },
  { id: "copy", label: "Copiar", category: "acciones" },
  { id: "clipboard", label: "Portapapeles", category: "acciones" },
  { id: "share-2", label: "Compartir", category: "acciones" },
  { id: "link", label: "Enlace", category: "acciones" },
  { id: "external-link", label: "Abrir fuera", category: "acciones" },
  { id: "zap", label: "Rayo", category: "acciones" },
  { id: "sparkles", label: "Destacar", category: "acciones" },

  { id: "home", label: "Inicio", category: "navegacion" },
  { id: "menu", label: "Menú", category: "navegacion" },
  { id: "layout-grid", label: "Cuadrícula", category: "navegacion" },
  { id: "list", label: "Lista", category: "navegacion" },
  { id: "chevron-left", label: "Anterior", category: "navegacion" },
  { id: "chevron-right", label: "Siguiente", category: "navegacion" },
  { id: "chevron-up", label: "Arriba", category: "navegacion" },
  { id: "chevron-down", label: "Abajo", category: "navegacion" },
  { id: "arrow-left", label: "Volver", category: "navegacion" },
  { id: "arrow-right", label: "Avanzar", category: "navegacion" },
  { id: "corner-up-left", label: "Retroceder", category: "navegacion" },
  { id: "compass", label: "Explorar", category: "navegacion" },
  { id: "map", label: "Mapa", category: "navegacion" },
  { id: "folder", label: "Carpeta", category: "navegacion" },
  { id: "folder-open", label: "Carpeta abierta", category: "navegacion" },

  { id: "minimize-2", label: "Minimizar", category: "ventana" },
  { id: "maximize-2", label: "Maximizar", category: "ventana" },
  { id: "panel-left", label: "Panel izq.", category: "ventana" },
  { id: "panel-right", label: "Panel der.", category: "ventana" },
  { id: "panel-top", label: "Barra sup.", category: "ventana" },
  { id: "columns-2", label: "Columnas", category: "ventana" },
  { id: "rows-2", label: "Filas", category: "ventana" },
  { id: "fullscreen", label: "Pantalla completa", category: "ventana" },
  { id: "shrink", label: "Reducir", category: "ventana" },
  { id: "expand", label: "Expandir", category: "ventana" },

  { id: "bell", label: "Notificación", category: "comunicacion" },
  { id: "bell-ring", label: "Alerta", category: "comunicacion" },
  { id: "message-circle", label: "Chat", category: "comunicacion" },
  { id: "messages-square", label: "Mensajes", category: "comunicacion" },
  { id: "mail", label: "Correo", category: "comunicacion" },
  { id: "send", label: "Enviar", category: "comunicacion" },
  { id: "users", label: "Usuarios", category: "comunicacion" },
  { id: "user", label: "Usuario", category: "comunicacion" },
  { id: "user-circle", label: "Perfil", category: "comunicacion" },
  { id: "user-plus", label: "Añadir usuario", category: "comunicacion" },
  { id: "megaphone", label: "Anuncio", category: "comunicacion" },
  { id: "rss", label: "Noticias", category: "comunicacion" },

  { id: "gamepad-2", label: "Juego", category: "juego" },
  { id: "puzzle", label: "Mods", category: "juego" },
  { id: "package", label: "Paquete", category: "juego" },
  { id: "box", label: "Caja", category: "juego" },
  { id: "pickaxe", label: "Pico", category: "juego" },
  { id: "sword", label: "Espada", category: "juego" },
  { id: "shield", label: "Escudo", category: "juego" },
  { id: "crown", label: "Premium", category: "juego" },
  { id: "trophy", label: "Logro", category: "juego" },
  { id: "flame", label: "Popular", category: "juego" },
  { id: "globe", label: "Servidor", category: "juego" },
  { id: "server", label: "Host", category: "juego" },
  { id: "hard-drive", label: "Instancia", category: "juego" },
  { id: "blocks", label: "Bloques", category: "juego" },

  { id: "search", label: "Buscar", category: "ui" },
  { id: "filter", label: "Filtrar", category: "ui" },
  { id: "sliders-horizontal", label: "Ajustes finos", category: "ui" },
  { id: "eye", label: "Ver", category: "ui" },
  { id: "eye-off", label: "Ocultar", category: "ui" },
  { id: "lock", label: "Bloquear", category: "ui" },
  { id: "unlock", label: "Desbloquear", category: "ui" },
  { id: "star", label: "Favorito", category: "ui" },
  { id: "heart", label: "Me gusta", category: "ui" },
  { id: "bookmark", label: "Marcador", category: "ui" },
  { id: "info", label: "Info", category: "ui" },
  { id: "help-circle", label: "Ayuda", category: "ui" },
  { id: "alert-circle", label: "Aviso", category: "ui" },
  { id: "alert-triangle", label: "Peligro", category: "ui" },
  { id: "circle-check", label: "OK", category: "ui" },
  { id: "circle-x", label: "Error", category: "ui" },
  { id: "loader-circle", label: "Cargando", category: "ui" },
  { id: "more-horizontal", label: "Más", category: "ui" },
  { id: "more-vertical", label: "Opciones", category: "ui" },
  { id: "grip-vertical", label: "Arrastrar", category: "ui" },
  { id: "pin", label: "Fijar", category: "ui" },
  { id: "tag", label: "Etiqueta", category: "ui" },
  { id: "hash", label: "Número", category: "ui" },
  { id: "calendar", label: "Calendario", category: "ui" },
  { id: "clock", label: "Reloj", category: "ui" },
  { id: "timer", label: "Temporizador", category: "ui" },

  { id: "image", label: "Imagen", category: "medios" },
  { id: "camera", label: "Cámara", category: "medios" },
  { id: "video", label: "Video", category: "medios" },
  { id: "music", label: "Música", category: "medios" },
  { id: "volume-2", label: "Volumen", category: "medios" },
  { id: "volume-x", label: "Silencio", category: "medios" },
  { id: "mic", label: "Micrófono", category: "medios" },
  { id: "monitor", label: "Monitor", category: "medios" },
  { id: "smartphone", label: "Móvil", category: "medios" },
  { id: "palette", label: "Paleta", category: "medios" },
  { id: "paintbrush", label: "Pincel", category: "medios" },
  { id: "code-2", label: "Código", category: "medios" },
  { id: "terminal", label: "Terminal", category: "medios" },
  { id: "file-text", label: "Documento", category: "medios" },
  { id: "shopping-bag", label: "Tienda", category: "medios" },
  { id: "credit-card", label: "Pago", category: "medios" },
];

export const HUB_ICON_IDS = new Set(HUB_ICON_CATALOG.map((icon) => icon.id));

const ACTION_ICON_FALLBACK: Partial<Record<HubElementAction, string>> = {
  play: "play",
  settings: "settings",
  "sync-layout": "refresh-cw",
  "minimize-window": "minus",
  "close-window": "x",
  mods: "puzzle",
  news: "rss",
  profile: "user-circle",
  chat: "message-circle",
  store: "shopping-bag",
  instances: "hard-drive",
  "create-instance": "plus",
  external: "external-link",
  back: "arrow-left",
  logout: "log-out",
  "open-launch-log": "file-text",
};

const LABEL_ICON_FALLBACK: Record<string, string> = {
  "⚙": "settings",
  "⚙️": "settings",
  "×": "x",
  "✕": "x",
  x: "x",
  X: "x",
  "−": "minus",
  "-": "minus",
  "—": "minus",
  "↻": "refresh-cw",
  "⟳": "refresh-cw",
  "▶": "play",
  "►": "play",
  "◉": "user-circle",
  "🔔": "bell",
  "⭐": "star",
  "❤": "heart",
  "❤️": "heart",
  sync: "refresh-cw",
  minimizar: "minus",
  cerrar: "x",
};

function readIconConst(element: HubElement): string {
  const raw = element.logic?.constants?.ICON_NAME;
  if (raw === undefined || raw === null) return "";
  return String(raw).trim();
}

export function isValidHubIconId(id: string): boolean {
  return HUB_ICON_IDS.has(id);
}

export function resolveHubElementIconName(element: HubElement): string {
  const stored = readIconConst(element);
  if (stored && isValidHubIconId(stored)) return stored;

  const actionIcon = ACTION_ICON_FALLBACK[element.action];
  if (actionIcon && isValidHubIconId(actionIcon)) return actionIcon;

  const labelKey = element.label?.trim() ?? "";
  const labelIcon = LABEL_ICON_FALLBACK[labelKey] ?? LABEL_ICON_FALLBACK[labelKey.toLowerCase()];
  if (labelIcon && isValidHubIconId(labelIcon)) return labelIcon;

  return DEFAULT_HUB_ICON;
}

export function defaultIconForPalette(paletteId: string, action: HubElementAction): string {
  if (paletteId === "chrome.syncBtn") return "refresh-cw";
  if (paletteId === "chrome.minimize") return "minus";
  if (paletteId === "chrome.close") return "x";
  if (paletteId === "basic.icon" || paletteId === "chrome.iconBtn") return "settings";
  const actionIcon = ACTION_ICON_FALLBACK[action];
  if (actionIcon && isValidHubIconId(actionIcon)) return actionIcon;
  return DEFAULT_HUB_ICON;
}
