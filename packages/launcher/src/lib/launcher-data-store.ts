import { create } from "zustand";
import type {
  CurseForgeModFile,
  CurseForgeModSummary,
  CurseForgeSearchPagination,
  FeaturedModpack,
  InstallLogEntry,
  LauncherInstance,
  LauncherSettings,
  ModCatalogTab,
} from "@craftlauncher/shared";
import {
  cfClassIdForTab,
  getLauncherApi,
  isInstalledModsPageResult,
  type InstalledModRow,
} from "./electron-api";
import { resolveModInstallStatus } from "./mod-install-status";
import { getAdminApiUrl } from "./config";
import { useAuthStore } from "./auth-store";

export type LauncherPanel = "instances" | "mods" | "skin" | null;

export type ModPreviewState = {
  mod: CurseForgeModSummary | null;
  files: CurseForgeModFile[];
  loading: boolean;
  error: string | null;
  filesWarning: string | null;
};

type LauncherDataState = {
  panel: LauncherPanel;
  settings: LauncherSettings | null;
  instances: LauncherInstance[];
  activeInstance: LauncherInstance | null;
  instanceStats: { modCount: number; resourcePackCount: number } | null;
  loading: boolean;
  error: string | null;
  modQuery: string;
  modResults: CurseForgeModSummary[];
  modSearchIndex: number;
  modSearchHasMore: boolean;
  modSearchLoadingMore: boolean;
  modTab: ModCatalogTab;
  modPreview: ModPreviewState;
  featuredModpacks: FeaturedModpack[];
  /** Mods elegidos en admin (catalogKind === mod) */
  curatedMods: FeaturedModpack[];
  /** Revisión del catálogo (cambia cuando el admin modifica /api/modpacks). */
  catalogRev: string;
  /** Indicadores de cambios nuevos por pestaña. */
  tabHasUpdate: Partial<Record<ModCatalogTab, boolean>>;
  /** Etiqueta configurable para la pestaña featured (admin). */
  featuredTabLabel: string;
  installLogs: InstallLogEntry[];
  installing: boolean;
  instanceDraftName: string;
  instanceDraftVersion: string;
  installedGameVersions: { id: string; label: string }[];
  installedMods: InstalledModRow[];
  installedModsLoading: boolean;
  installedModsRefreshing: boolean;
  installedModsLoadingMore: boolean;
  installedModsHasMore: boolean;
  installedModsTotal: number;
  installedModsRev: number;
  installedModsQuery: string;
  selectedInstalledModFile: string | null;

  openPanel: (panel: LauncherPanel) => void;
  closePanel: () => void;
  bootstrap: () => Promise<void>;
  pickDataDir: () => Promise<void>;
  saveDataDir: (dir: string) => Promise<void>;
  createInstance: (input: Partial<LauncherInstance>) => Promise<void>;
  deleteInstance: (id: string) => Promise<void>;
  selectInstance: (id: string) => Promise<void>;
  setModTab: (tab: ModCatalogTab) => void;
  searchMods: (query?: string) => Promise<void>;
  loadMoreMods: () => Promise<void>;
  loadModPreview: (
    modId: number,
    summary?: CurseForgeModSummary,
    opts?: { preserveInstalledSelection?: boolean }
  ) => Promise<void>;
  loadInstalledModPreview: (row: InstalledModRow) => Promise<void>;
  clearModPreview: () => void;
  loadFeaturedModpacks: () => Promise<void>;
  installMod: (modId: number) => Promise<void>;
  installPreview: () => Promise<void>;
  installFeatured: (pack: FeaturedModpack) => Promise<void>;
  ensureModpackForPlay: () => Promise<boolean>;
  pushInstallLog: (entry: Omit<InstallLogEntry, "id" | "time">) => void;
  clearInstallLogs: () => void;
  handleInstallProgress: (payload: Record<string, unknown>) => void;
  setInstanceDraftName: (name: string) => void;
  setInstanceDraftVersion: (mcVersion: string) => void;
  resetInstanceDraft: () => void;
  submitInstanceDraft: () => Promise<void>;
  refreshInstalledVersions: () => Promise<void>;
  refreshInstalledMods: (opts?: { checkUpdates?: boolean }) => Promise<void>;
  loadMoreInstalledMods: () => Promise<void>;
  deleteInstalledMod: (fileName: string) => Promise<void>;
  updateInstalledMod: (fileName: string) => Promise<void>;
  setInstalledModEnabled: (fileName: string, enabled: boolean) => Promise<void>;
  setInstalledModsQuery: (query: string) => void;
};

let logCounter = 0;

const MOD_SEARCH_PAGE_SIZE = 24;
const INSTALLED_MODS_PAGE_SIZE = 60;

function resolveSearchHasMore(
  incomingCount: number,
  pagination?: CurseForgeSearchPagination,
  pageSize = MOD_SEARCH_PAGE_SIZE
) {
  if (incomingCount <= 0) return false;
  if (pagination) {
    const index = Number(pagination.index) || 0;
    const resultCount = Number.isFinite(Number(pagination.resultCount))
      ? Number(pagination.resultCount)
      : incomingCount;
    const totalCount = Number(pagination.totalCount);
    if (Number.isFinite(totalCount) && totalCount >= 0) {
      return index + resultCount < totalCount;
    }
  }
  // Sin metadatos de paginación: intentar otra página si esta trajo resultados.
  return incomingCount > 0;
}

function mergeUniqueMods(existing: CurseForgeModSummary[], incoming: CurseForgeModSummary[]) {
  const seen = new Set(existing.map((m) => m.id));
  const next = [...existing];
  for (const mod of incoming) {
    if (seen.has(mod.id)) continue;
    seen.add(mod.id);
    next.push(mod);
  }
  return next;
}

const emptyPreview = (): ModPreviewState => ({
  mod: null,
  files: [],
  loading: false,
  error: null,
  filesWarning: null,
});

async function loadStatsForInstance(instanceId: string | undefined) {
  const api = getLauncherApi();
  if (!api?.instanceStats || !instanceId) return null;
  try {
    return await api.instanceStats(instanceId);
  } catch {
    return null;
  }
}

async function backfillInstanceIcons(instances: LauncherInstance[]) {
  const api = getLauncherApi();
  if (!api?.getModDetails || !api?.updateInstance) return false;
  const missing = instances.filter((i) => i.curseForgeId && !i.iconUrl);
  if (!missing.length) return false;

  let updated = false;
  for (const inst of missing) {
    try {
      const res = await api.getModDetails(inst.curseForgeId!, {});
      const logoUrl = res?.mod?.logoUrl;
      if (!logoUrl) continue;
      await api.updateInstance(inst.id, { iconUrl: logoUrl });
      updated = true;
    } catch {
      /* ignore */
    }
  }
  return updated;
}

export const useLauncherDataStore = create<LauncherDataState>((set, get) => ({
  panel: null,
  settings: null,
  instances: [],
  activeInstance: null,
  instanceStats: null,
  loading: false,
  error: null,
  modQuery: "",
  modResults: [],
  modSearchIndex: 0,
  modSearchHasMore: false,
  modSearchLoadingMore: false,
  modTab: "featured",
  modPreview: emptyPreview(),
  featuredModpacks: [],
  curatedMods: [],
  catalogRev: "0",
  tabHasUpdate: {},
  featuredTabLabel: "Eventos",
  installLogs: [],
  installing: false,
  instanceDraftName: "",
  instanceDraftVersion: "1.20.1",
  installedGameVersions: [],
  installedMods: [],
  installedModsLoading: false,
  installedModsRefreshing: false,
  installedModsLoadingMore: false,
  installedModsHasMore: false,
  installedModsTotal: 0,
  installedModsRev: 0,
  installedModsQuery: "",
  selectedInstalledModFile: null,

  setInstalledModsQuery: (query) => set({ installedModsQuery: query }),

  refreshInstalledMods: async (opts) => {
    const api = getLauncherApi();
    const instanceId = get().activeInstance?.id;
    if (!api?.listInstalledMods || !instanceId) {
      set({
        installedMods: [],
        installedModsLoading: false,
        installedModsRefreshing: false,
        installedModsHasMore: false,
        installedModsTotal: 0,
      });
      return;
    }
    const existingCount = get().installedMods.length;
    const isInitialLoad = existingCount === 0;
    set(
      isInitialLoad
        ? { installedModsLoading: true, installedModsRefreshing: false, installedModsLoadingMore: false }
        : { installedModsRefreshing: true, installedModsLoadingMore: false }
    );
    try {
      const fetchLimit = isInitialLoad
        ? INSTALLED_MODS_PAGE_SIZE
        : Math.max(INSTALLED_MODS_PAGE_SIZE, existingCount);
      const result = await api.listInstalledMods(instanceId, {
        checkUpdates: opts?.checkUpdates ?? false,
        offset: 0,
        limit: fetchLimit,
      });
      if (isInstalledModsPageResult(result)) {
        set((s) => ({
          installedMods: result.rows,
          installedModsLoading: false,
          installedModsRefreshing: false,
          installedModsHasMore: result.hasMore,
          installedModsTotal: result.total,
          installedModsRev: s.installedModsRev + 1,
        }));
      } else if (Array.isArray(result)) {
        set((s) => ({
          installedMods: result,
          installedModsLoading: false,
          installedModsRefreshing: false,
          installedModsHasMore: false,
          installedModsTotal: result.length,
          installedModsRev: s.installedModsRev + 1,
        }));
      } else {
        set({
          installedMods: isInitialLoad ? [] : get().installedMods,
          installedModsLoading: false,
          installedModsRefreshing: false,
          error: "No se pudo leer la lista de mods instalados",
        });
        return;
      }
      const stats = await loadStatsForInstance(instanceId);
      if (stats) set({ instanceStats: stats });
    } catch (err) {
      set({
        installedModsLoading: false,
        installedModsRefreshing: false,
        error: err instanceof Error ? err.message : "Error al listar mods instalados",
      });
    }
  },

  loadMoreInstalledMods: async () => {
    const api = getLauncherApi();
    const instanceId = get().activeInstance?.id;
    const { installedMods, installedModsHasMore, installedModsLoadingMore, installedModsLoading } = get();
    const isInitialLoad = installedMods.length === 0 && installedModsLoading;
    if (
      !api?.listInstalledMods ||
      !instanceId ||
      !installedModsHasMore ||
      installedModsLoadingMore ||
      isInitialLoad
    ) {
      return;
    }
    set({ installedModsLoadingMore: true });
    try {
      const result = await api.listInstalledMods(instanceId, {
        checkUpdates: false,
        offset: installedMods.length,
        limit: INSTALLED_MODS_PAGE_SIZE,
      });
      if (!isInstalledModsPageResult(result)) {
        set({ installedModsLoadingMore: false, installedModsHasMore: false });
        return;
      }
      set((s) => ({
        installedMods: [...s.installedMods, ...result.rows],
        installedModsLoadingMore: false,
        installedModsHasMore: result.hasMore,
        installedModsTotal: result.total,
        installedModsRev: s.installedModsRev + 1,
      }));
    } catch (err) {
      set({
        installedModsLoadingMore: false,
        error: err instanceof Error ? err.message : "Error al cargar más mods instalados",
      });
    }
  },

  deleteInstalledMod: async (fileName) => {
    const api = getLauncherApi();
    const instanceId = get().activeInstance?.id;
    if (!api?.deleteInstalledMod || !instanceId) return;
    set({ error: null });
    try {
      const result = await api.deleteInstalledMod(instanceId, fileName);
      if (result?.ok === false || result?.error) throw new Error(result?.error ?? "No se pudo borrar");
      set((s) => ({
        installedMods: s.installedMods.filter((r) => r.fileName !== fileName),
        installedModsTotal: Math.max(0, s.installedModsTotal - 1),
      }));
      const stats = await loadStatsForInstance(instanceId);
      if (stats) set({ instanceStats: stats });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "No se pudo borrar el mod" });
    }
  },

  setInstalledModEnabled: async (fileName, enabled) => {
    const api = getLauncherApi();
    const instanceId = get().activeInstance?.id;
    if (!api?.setInstalledModEnabled || !instanceId) return;
    set({ error: null });
    try {
      const result = await api.setInstalledModEnabled(instanceId, fileName, enabled);
      if (result?.ok === false || result?.error) throw new Error(result?.error ?? "No se pudo cambiar el estado del mod");
      const nextName = result.fileName ?? fileName;
      const nextEnabled = result.enabled ?? enabled;
      set((s) => ({
        installedMods: s.installedMods.map((r) =>
          r.fileName === fileName
            ? { ...r, fileName: nextName, disabled: !nextEnabled }
            : r
        ),
      }));
      const stats = await loadStatsForInstance(instanceId);
      if (stats) set({ instanceStats: stats });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "No se pudo cambiar el estado del mod" });
    }
  },

  updateInstalledMod: async (fileName) => {
    const api = getLauncherApi();
    const instanceId = get().activeInstance?.id;
    if (!api?.updateInstalledMod || !instanceId) return;
    get().clearInstallLogs();
    get().pushInstallLog({ level: "info", message: `Actualizando ${fileName}…` });
    try {
      const result = await api.updateInstalledMod(instanceId, fileName);
      if (result?.ok === false || result?.error) throw new Error(result?.error ?? "No se pudo actualizar");
      get().pushInstallLog({
        level: "ok",
        message: result.updated ? "Mod actualizado" : "Ya estaba al día",
        detail: result.fileName,
      });
      await get().refreshInstalledMods({ checkUpdates: true });
    } catch (err) {
      get().pushInstallLog({
        level: "error",
        message: err instanceof Error ? err.message : "Error al actualizar",
      });
      set({ error: err instanceof Error ? err.message : "Error al actualizar" });
    }
  },

  refreshInstalledVersions: async () => {
    const api = getLauncherApi();
    const id = get().activeInstance?.id;
    if (!api?.listInstalledGameVersions || !id) {
      set({ installedGameVersions: [] });
      return;
    }
    try {
      const versions = await api.listInstalledGameVersions(id);
      set({ installedGameVersions: versions ?? [] });
    } catch {
      set({ installedGameVersions: [] });
    }
  },

  setInstanceDraftName: (name) => set({ instanceDraftName: name }),
  setInstanceDraftVersion: (mcVersion) => set({ instanceDraftVersion: mcVersion }),
  resetInstanceDraft: () => set({ instanceDraftName: "", instanceDraftVersion: "1.20.1" }),

  submitInstanceDraft: async () => {
    const { instanceDraftName, instanceDraftVersion } = get();
    const mcVersion = instanceDraftVersion.trim() || "1.20.1";
    const name = instanceDraftName.trim();
    await get().createInstance({
      name: name || mcVersion,
      mcVersion,
      loader: "forge",
    });
    set({ instanceDraftName: "", instanceDraftVersion: mcVersion });
  },

  openPanel: (panel) => {
    set({ panel, error: null });
    if (panel === "mods") {
      void get().loadFeaturedModpacks();
      if (get().modTab !== "featured") void get().searchMods(get().modQuery);
    }
    if (panel === "instances") void get().bootstrap();
  },

  closePanel: () => set({ panel: null, modPreview: emptyPreview() }),

  bootstrap: async () => {
    const api = getLauncherApi();
    if (!api?.listInstances) {
      set({
        loading: false,
        error:
          "Catálogo no disponible en navegador. Abre el launcher desktop (npm run launcher:dev) para ver mods.",
      });
      return;
    }
    set({ loading: true, error: null });
    try {
      const data = await api.listInstances();
      const active = data.instances.find((i) => i.id === data.settings.activeInstanceId) ?? data.instances[0] ?? null;
      const stats = active ? await loadStatsForInstance(active.id) : null;
      set({
        settings: data.settings,
        instances: data.instances,
        activeInstance: active,
        instanceStats: stats,
        loading: false,
      });
      try {
        const res = await fetch(`${getAdminApiUrl()}/api/catalog-settings`, { cache: "no-store" });
        if (res.ok) {
          const d = (await res.json()) as { settings?: { featuredTabLabel?: string } };
          const label = d.settings?.featuredTabLabel?.trim();
          if (label) set({ featuredTabLabel: label });
        }
      } catch {
        /* ignore */
      }
      await get().refreshInstalledVersions();
      await get().refreshInstalledMods();
      void backfillInstanceIcons(data.instances).then(async (changed) => {
        if (changed) await reloadInstancesFromDisk();
      });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : "Error al cargar datos" });
    }
  },

  pickDataDir: async () => {
    const api = getLauncherApi();
    if (!api?.pickDataDir) return;
    const settings = await api.pickDataDir();
    if (settings) {
      set({ settings });
      await get().bootstrap();
    }
  },

  saveDataDir: async (dir) => {
    const api = getLauncherApi();
    if (!api?.saveSettings) return;
    const settings = await api.saveSettings({ dataDir: dir });
    set({ settings });
    await get().bootstrap();
  },

  createInstance: async (input) => {
    const api = getLauncherApi();
    if (!api?.createInstance) return;
    set({ loading: true });
    await api.createInstance(input);
    await get().bootstrap();
    set({ loading: false });
  },

  deleteInstance: async (id) => {
    const api = getLauncherApi();
    if (!api?.deleteInstance) return;
    set({ loading: true });
    const data = await api.deleteInstance(id);
    const active = data.instances.find((i) => i.id === data.settings.activeInstanceId) ?? data.instances[0] ?? null;
    const stats = active ? await loadStatsForInstance(active.id) : null;
    set({ settings: data.settings, instances: data.instances, activeInstance: active, instanceStats: stats, loading: false });
  },

  selectInstance: async (id) => {
    const api = getLauncherApi();
    if (!api?.selectInstance) return;
    const data = await api.selectInstance(id);
    const active = data.instances.find((i) => i.id === id) ?? null;
    const stats = await loadStatsForInstance(id);
    set({
      settings: data.settings,
      instances: data.instances,
      activeInstance: active,
      instanceStats: stats,
      modPreview: emptyPreview(),
      installedMods: [],
      installedModsTotal: 0,
      installedModsHasMore: false,
      installedModsRefreshing: false,
    });
    await get().refreshInstalledVersions();
    await get().refreshInstalledMods();
  },

  setModTab: (tab) => {
    const nextTabHasUpdate = { ...get().tabHasUpdate };
    if (tab === "featured") {
      const rev = get().catalogRev ?? "0";
      try {
        localStorage.setItem("craftlauncher:lastSeenCatalogRev:featured", rev);
      } catch {
        /* ignore */
      }
      nextTabHasUpdate.featured = false;
    }
    set({ modTab: tab, error: null, modPreview: emptyPreview(), tabHasUpdate: nextTabHasUpdate });
    if (tab === "featured" || tab === "mods") void get().loadFeaturedModpacks();
    if (tab !== "featured") void get().searchMods(get().modQuery);
  },

  searchMods: async (query) => {
    const api = getLauncherApi();
    if (!api) {
      set({
        loading: false,
        error:
          "Catálogo no disponible en navegador. Abre el launcher desktop (npm run launcher:dev) para ver mods.",
        modResults: [],
        modSearchIndex: 0,
        modSearchHasMore: false,
      });
      return;
    }
    const q = (query ?? get().modQuery).trim();
    const tab = get().modTab;
    set({
      modQuery: q,
      loading: true,
      error: null,
      modPreview: emptyPreview(),
      modSearchIndex: 0,
      modSearchHasMore: false,
      modSearchLoadingMore: false,
    });

    if (tab === "featured") {
      set({ loading: false });
      return;
    }

    try {
      const instance = get().activeInstance;
      const mcVersion = instance?.mcVersion ?? "1.20.1";
      const loader = instance?.loader ?? "forge";
      const opts = { mcVersion, loader, pageSize: MOD_SEARCH_PAGE_SIZE, index: 0 };
      const defaultQ =
        tab === "modpacks" ? "all the mods" : tab === "resourcepacks" ? "faithful" : "jei";

      let res;
      if (tab === "modpacks" && api.searchModpacks) {
        res = await api.searchModpacks(q || defaultQ, opts);
      } else if (tab === "resourcepacks" && api.searchResourcePacks) {
        res = await api.searchResourcePacks(q || defaultQ, opts);
      } else if (api.searchMods) {
        res = await api.searchMods(q || defaultQ, opts);
      } else {
        throw new Error("CurseForge no disponible en este entorno");
      }

      if (res?.ok === false) {
        set({ loading: false, error: res.error ?? "Error CurseForge", modResults: [] });
        return;
      }

      const mods = res?.mods ?? [];
      set({
        modResults: mods,
        loading: false,
        modSearchIndex: mods.length,
        modSearchHasMore: resolveSearchHasMore(mods.length, res?.pagination, MOD_SEARCH_PAGE_SIZE),
      });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Error CurseForge",
        modResults: [],
        modSearchHasMore: false,
      });
    }
  },

  loadMoreMods: async () => {
    const api = getLauncherApi();
    const {
      modSearchHasMore,
      modSearchLoadingMore,
      modSearchIndex,
      loading,
      modQuery,
      modTab,
      modResults,
      activeInstance,
    } = get();
    if (!api || !modSearchHasMore || modSearchLoadingMore || loading || modTab === "featured") return;

    set({ modSearchLoadingMore: true });
    try {
      const mcVersion = activeInstance?.mcVersion ?? "1.20.1";
      const loader = activeInstance?.loader ?? "forge";
      const opts = { mcVersion, loader, pageSize: MOD_SEARCH_PAGE_SIZE, index: modSearchIndex };
      const defaultQ =
        modTab === "modpacks" ? "all the mods" : modTab === "resourcepacks" ? "faithful" : "jei";
      const q = modQuery.trim() || defaultQ;

      let res;
      if (modTab === "modpacks" && api.searchModpacks) {
        res = await api.searchModpacks(q, opts);
      } else if (modTab === "resourcepacks" && api.searchResourcePacks) {
        res = await api.searchResourcePacks(q, opts);
      } else if (api.searchMods) {
        res = await api.searchMods(q, opts);
      } else {
        throw new Error("CurseForge no disponible en este entorno");
      }

      if (res?.ok === false) {
        set({ modSearchLoadingMore: false, error: res.error ?? "Error CurseForge" });
        return;
      }

      const incoming = res?.mods ?? [];
      const merged = mergeUniqueMods(modResults, incoming);
      const added = merged.length - modResults.length;
      const hasMore =
        incoming.length > 0 &&
        added > 0 &&
        resolveSearchHasMore(incoming.length, res?.pagination, MOD_SEARCH_PAGE_SIZE);
      set({
        modResults: merged,
        modSearchLoadingMore: false,
        modSearchIndex: modSearchIndex + incoming.length,
        modSearchHasMore: hasMore,
      });
    } catch (err) {
      set({
        modSearchLoadingMore: false,
        error: err instanceof Error ? err.message : "Error CurseForge",
      });
    }
  },

  loadModPreview: async (modId, summary, opts) => {
    const api = getLauncherApi();
    if (!api?.getModDetails) return;
    const tab = get().modTab;
    const instance = get().activeInstance;
    const mcVersion = instance?.mcVersion ?? "1.20.1";
    const loader = instance?.loader ?? "forge";
    const classId = cfClassIdForTab(tab);

    set({
      selectedInstalledModFile: opts?.preserveInstalledSelection ? get().selectedInstalledModFile : null,
      modPreview: {
        mod: summary ?? null,
        files: [],
        loading: true,
        error: null,
        filesWarning: null,
      },
    });

    try {
      const res = await api.getModDetails(modId, { mcVersion, loader, classId, cachedMod: summary });
      if (res?.ok === false && !summary) {
        set({
          modPreview: {
            mod: null,
            files: [],
            loading: false,
            error: res?.error ?? "No se pudo cargar la vista previa",
            filesWarning: null,
          },
        });
        return;
      }

      const mod = res.mod ?? summary ?? null;
      if (!mod) {
        set({
          modPreview: {
            mod: null,
            files: [],
            loading: false,
            error: res?.error ?? "No se pudo cargar la vista previa",
            filesWarning: null,
          },
        });
        return;
      }

      set({
        modPreview: {
          mod,
          files: res.files ?? [],
          loading: false,
          error: null,
          filesWarning: res.filesError ?? (res.files?.length ? null : "No hay archivos listados para tu versión — puedes intentar instalar igual."),
        },
      });
    } catch (err) {
      if (summary) {
        set({
          modPreview: {
            mod: summary,
            files: [],
            loading: false,
            error: null,
            filesWarning: err instanceof Error ? err.message : "No se pudieron cargar los archivos",
          },
        });
        return;
      }
      set({
        modPreview: {
          mod: null,
          files: [],
          loading: false,
          error: err instanceof Error ? err.message : "Error al cargar vista previa",
          filesWarning: null,
        },
      });
    }
  },

  loadInstalledModPreview: async (row) => {
    set({ selectedInstalledModFile: row.fileName, error: null });
    if (row.modId) {
      const summary: CurseForgeModSummary = {
        id: row.modId,
        name: row.displayName ?? row.fileName,
        slug: "",
        summary: "",
        downloadCount: 0,
        authors: [],
      };
      await get().loadModPreview(row.modId, summary, { preserveInstalledSelection: true });
      return;
    }

    const sizeKb = row.size >= 1024 * 1024
      ? `${(row.size / (1024 * 1024)).toFixed(1)} MB`
      : row.size >= 1024
        ? `${(row.size / 1024).toFixed(1)} KB`
        : `${row.size} B`;

    set({
      modPreview: {
        mod: {
          id: 0,
          name: row.displayName ?? row.fileName,
          slug: "",
          summary: [
            `Archivo: ${row.fileName}`,
            `Tamaño: ${sizeKb}`,
            row.disabled ? "Estado: desactivado (no se carga al jugar)." : "Estado: activo en el perfil.",
          ].join("\n"),
          downloadCount: 0,
          authors: [],
          categories: ["Instalado localmente"],
        },
        files: [],
        loading: false,
        error: null,
        filesWarning:
          "Sin datos de CurseForge para este archivo. Solo se muestra la información local del mod instalado.",
      },
    });
  },

  clearModPreview: () => set({ modPreview: emptyPreview(), selectedInstalledModFile: null }),

  loadFeaturedModpacks: async () => {
    const splitCatalog = (list: FeaturedModpack[]) => {
      const enabled = list.filter((m) => m.enabled);
      return {
        featuredModpacks: enabled.filter((m) => m.catalogKind !== "mod"),
        curatedMods: enabled.filter((m) => m.catalogKind === "mod"),
      };
    };
    try {
      const res = await fetch(`${getAdminApiUrl()}/api/modpacks`, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { modpacks?: FeaturedModpack[]; rev?: string };
        const rev = String(data.rev ?? "0");
        const prevRev = get().catalogRev;
        const nextTabHasUpdate = { ...get().tabHasUpdate };
        if (rev !== prevRev) {
          let lastSeen = "0";
          try {
            lastSeen = localStorage.getItem("craftlauncher:lastSeenCatalogRev:featured") ?? "0";
          } catch {
            /* ignore */
          }
          nextTabHasUpdate.featured = rev !== lastSeen;
        }
        set({ ...splitCatalog(data.modpacks ?? []), catalogRev: rev, tabHasUpdate: nextTabHasUpdate });
        return;
      }
    } catch {
      /* admin offline */
    }
    set({ featuredModpacks: [], curatedMods: [], catalogRev: "0" });
  },

  pushInstallLog: (entry) => {
    const row: InstallLogEntry = {
      id: `log-${++logCounter}`,
      time: new Date().toISOString(),
      ...entry,
    };
    set((s) => ({ installLogs: [...s.installLogs, row].slice(-80) }));
  },

  clearInstallLogs: () => set({ installLogs: [] }),

  handleInstallProgress: (payload) => {
    const stage = String(payload.stage ?? "");
    const level = String(payload.level ?? "");

    if (stage === "install-log" && payload.message) {
      get().pushInstallLog({
        level: (level as InstallLogEntry["level"]) || "info",
        message: String(payload.message),
        detail: payload.detail ? String(payload.detail) : undefined,
      });
      // Los eventos IPC llegan en batch (300 ms) y pueden aparecer DESPUÉS del finally.
      if (level === "ok" || level === "error") {
        set({ installing: false });
      }
      return;
    }

    if (stage === "install-done") {
      set({ installing: false });
      return;
    }

    if (stage === "error") {
      set({ installing: false, error: String(payload.message ?? "Error") });
    }
  },

  installMod: async (modId) => {
    const api = getLauncherApi();
    if (!api?.installMod) return;
    const tab = get().modTab;
    const kind = tab === "resourcepacks" ? "resourcepack" : "mod";

    set({ installing: true, error: null });
    get().clearInstallLogs();
    get().pushInstallLog({
      level: "info",
      message: kind === "resourcepack" ? "Instalando texture pack…" : "Iniciando instalación de mod…",
    });

    try {
      const result = await api.installMod(modId, { kind });
      if (result?.ok === false || result?.error) {
        throw new Error(result?.error ?? "Error al instalar");
      }
      get().pushInstallLog({ level: "ok", message: "Instalado correctamente" });
      await get().refreshInstalledMods();
    } catch (err) {
      get().pushInstallLog({
        level: "error",
        message: err instanceof Error ? err.message : "Error al instalar",
      });
      set({ error: err instanceof Error ? err.message : "Error al instalar" });
    } finally {
      set({ installing: false });
    }
  },

  installPreview: async () => {
    const preview = get().modPreview.mod;
    if (!preview) return;
    const tab = get().modTab;
    const installStatus = resolveModInstallStatus(
      preview.id,
      get().installedMods,
      get().modPreview.files
    );

    if (installStatus.state === "installed" && tab !== "modpacks" && tab !== "featured") {
      get().pushInstallLog({ level: "info", message: `${preview.name} ya está instalado en este perfil` });
      return;
    }

    if (installStatus.state === "update") {
      await get().updateInstalledMod(installStatus.row.fileName);
      return;
    }

    if (tab === "featured") {
      const pack = get().featuredModpacks.find((p) => p.curseForgeId === preview.id);
      if (pack) {
        await get().installFeatured(pack);
        return;
      }
    }

    if (tab === "modpacks") {
      const api = getLauncherApi();
      if (!api?.installModpack) return;
      set({ installing: true, error: null });
      get().clearInstallLogs();
      get().pushInstallLog({ level: "info", message: `Instalando modpack ${preview.name}…` });
      try {
        const active = get().activeInstance;
        const result = await api.installModpack(preview.id, {
          mcVersion: active?.mcVersion,
          loader: active?.loader ?? "forge",
        });
        if (result?.ok === false || result?.error) throw new Error(result?.error ?? "Error");
        get().pushInstallLog({ level: "ok", message: "Modpack instalado" });
        await reloadInstancesFromDisk();
        await get().refreshInstalledMods();
      } catch (err) {
        get().pushInstallLog({ level: "error", message: err instanceof Error ? err.message : "Error" });
        set({ error: err instanceof Error ? err.message : "Error" });
      } finally {
        set({ installing: false });
      }
      return;
    }
    await get().installMod(preview.id);
  },

  installFeatured: async (pack) => {
    if (!pack.curseForgeId) {
      set({ error: "Este elemento no tiene ID de CurseForge configurado en el admin" });
      return;
    }
    if (pack.premiumOnly && !useAuthStore.getState().isPremium) {
      set({
        error:
          "Solo premium. Usa las pestañas Mods o Modpacks para buscar e instalar gratis desde CurseForge.",
      });
      return;
    }
    if (pack.catalogKind === "mod") {
      await get().installMod(pack.curseForgeId);
      return;
    }
    const api = getLauncherApi();
    if (!api?.installModpack) return;
    // Para modpacks configurados en admin: crear una instancia con el nombre indicado.
    if (api.createInstance && api.selectInstance) {
      try {
        const iconUrl = await resolveCurseForgeIconUrl(pack.curseForgeId);
        const created = await api.createInstance({
          name: pack.instanceName || pack.name,
          mcVersion: pack.mcVersion,
          loader: pack.loader,
          curseForgeId: pack.curseForgeId,
          iconUrl,
        });
        if (created?.id) {
          const data = await api.selectInstance(created.id);
          const active = data.instances.find((i) => i.id === created.id) ?? null;
          const stats = await loadStatsForInstance(created.id);
          set({
            settings: data.settings,
            instances: data.instances,
            activeInstance: active,
            instanceStats: stats,
            modPreview: emptyPreview(),
          });
        }
      } catch {
        /* fallback: instalar en instancia activa */
      }
    }
    set({ installing: true, error: null });
    get().clearInstallLogs();
    get().pushInstallLog({ level: "info", message: `Instalando modpack ${pack.name}…` });
    try {
      const result = await api.installModpack(pack.curseForgeId, {
        mcVersion: pack.mcVersion,
        loader: pack.loader,
      });
      if (result?.ok === false || result?.error) throw new Error(result?.error ?? "Error");
      get().pushInstallLog({
        level: "ok",
        message: `${pack.name} instalado`,
        detail: result.modCount ? `${result.modCount} mods` : undefined,
      });
      await reloadInstancesFromDisk();
      await get().refreshInstalledMods();
    } catch (err) {
      get().pushInstallLog({
        level: "error",
        message: err instanceof Error ? err.message : "Error al instalar modpack",
      });
      set({ error: err instanceof Error ? err.message : "Error" });
    } finally {
      set({ installing: false });
    }
  },

  ensureModpackForPlay: async () => {
    const api = getLauncherApi();
    if (!api?.installModpack) return true;

    const instance = get().activeInstance;
    if (!instance) return true;

    let stats = get().instanceStats;
    if ((!stats || stats.modCount === 0) && instance.id && api.instanceStats) {
      stats = (await loadStatsForInstance(instance.id)) ?? stats;
      if (stats) set({ instanceStats: stats });
    }
    if (stats && stats.modCount > 0) return true;

    if (!get().featuredModpacks.length) {
      await get().loadFeaturedModpacks();
    }

    const pack =
      (instance.curseForgeId
        ? get().featuredModpacks.find((p) => p.curseForgeId === instance.curseForgeId)
        : null) ??
      get().featuredModpacks.find(
        (p) =>
          p.curseForgeId &&
          p.catalogKind !== "mod" &&
          (p.instanceName === instance.name || p.name === instance.name)
      );

    if (!pack?.curseForgeId) return true;

    set({ installing: true, error: null });
    get().clearInstallLogs();
    get().pushInstallLog({
      level: "info",
      message: `Instalando ${pack.name} desde CurseForge…`,
    });
    try {
      const result = await api.installModpack(pack.curseForgeId, {
        mcVersion: pack.mcVersion,
        loader: pack.loader,
      });
      if (result?.ok === false || result?.error) throw new Error(result?.error ?? "Error al instalar");
      get().pushInstallLog({
        level: "ok",
        message: `${pack.name} listo para jugar`,
        detail: result.modCount ? `${result.modCount} mods` : undefined,
      });
      await reloadInstancesFromDisk();
      await get().refreshInstalledMods();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al instalar modpack";
      get().pushInstallLog({ level: "error", message });
      set({ error: message });
      return false;
    } finally {
      set({ installing: false });
    }
  },
}));

async function reloadInstancesFromDisk() {
  const api = getLauncherApi();
  if (!api?.listInstances) return;
  const data = await api.listInstances();
  const activeId =
    data.settings.activeInstanceId ?? useLauncherDataStore.getState().settings?.activeInstanceId ?? null;
  const active = data.instances.find((i) => i.id === activeId) ?? data.instances[0] ?? null;
  useLauncherDataStore.setState({
    settings: data.settings,
    instances: data.instances,
    activeInstance: active,
  });
}

async function resolveCurseForgeIconUrl(modId: number): Promise<string | undefined> {
  const api = getLauncherApi();
  if (!api?.getModDetails) return undefined;
  try {
    const preview = useLauncherDataStore.getState().modPreview.mod;
    const res = await api.getModDetails(modId, {
      cachedMod: preview?.id === modId ? preview : undefined,
    });
    return res?.mod?.logoUrl;
  } catch {
    return undefined;
  }
}
