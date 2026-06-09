/** Configuración local del launcher (por PC / por usuario) */

export type ModLoader = "forge" | "fabric" | "quilt" | "vanilla";

export interface LauncherSettings {
  /** Carpeta raíz (.craftlauncher). Cada PC elige la suya. */
  dataDir: string;
  activeInstanceId: string | null;
  /** Config de ventana (solo launcher desktop). */
  window?: {
    width?: number;
    height?: number;
    /** Si true, bloquea el resize del usuario. */
    lockSize?: boolean;
    /** Ventana sin bordes ocupando el área útil del monitor principal. */
    borderlessFullscreen?: boolean;
  };
  updatedAt: string;
}

export interface LauncherInstance {
  /** Identificador = nombre de carpeta legible (ej. prueba-1, 1-12-2). */
  id: string;
  name: string;
  mcVersion: string;
  loader: ModLoader;
  /** Versión Forge (solo si loader === forge) */
  forgeVersion?: string;
  /** Proyecto CurseForge vinculado (modpack instalado desde catálogo). */
  curseForgeId?: number;
  iconColor?: string;
  /** Icono del modpack (p. ej. logo CurseForge). */
  iconUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type CatalogKind = "modpack" | "mod";

/** Modpack o mod destacado configurado desde el admin */
export interface FeaturedModpack {
  id: string;
  name: string;
  description: string;
  mcVersion: string;
  loader: ModLoader;
  /** ID del proyecto en CurseForge (opcional) */
  curseForgeId?: number;
  /** Slug CurseForge para búsqueda */
  curseForgeSlug?: string;
  /** modpack = instalación completa; mod = JAR suelto en la instancia activa */
  catalogKind?: CatalogKind;
  /** Si catalogKind === "modpack": nombre de la instancia a crear al instalar (si no, usa name). */
  instanceName?: string;
  modCount: number;
  /** Métricas de CurseForge (admin / UI) */
  downloads?: number;
  sizeMb?: number;
  enabled: boolean;
  premiumOnly: boolean;
  author: string;
  updatedAt: string;
}

export type ModCatalogTab = "featured" | "mods" | "modpacks" | "resourcepacks";

/** Resultado de búsqueda CurseForge (simplificado) */
export interface CurseForgeModSummary {
  id: number;
  name: string;
  slug: string;
  summary: string;
  downloadCount: number;
  logoUrl?: string;
  authors: string[];
  dateModified?: string;
  websiteUrl?: string;
  categories?: string[];
}

export interface CurseForgeModPreview {
  mod: CurseForgeModSummary;
  files: CurseForgeModFile[];
}

export interface CurseForgeSearchPagination {
  index: number;
  pageSize: number;
  resultCount: number;
  totalCount: number;
}

export interface CurseForgeSearchResult {
  ok: boolean;
  error?: string;
  mods: CurseForgeModSummary[];
  pagination?: CurseForgeSearchPagination;
}

export interface CurseForgeModFile {
  id: number;
  displayName: string;
  fileName: string;
  fileLength: number;
  downloadUrl: string;
  gameVersions: string[];
}

export type InstallLogLevel = "info" | "step" | "ok" | "warn" | "error";

export interface InstallLogEntry {
  id: string;
  time: string;
  level: InstallLogLevel;
  message: string;
  detail?: string;
}
