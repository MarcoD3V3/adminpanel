import { createStore, useStore } from "zustand";
import {
  actionFallbackLabel,
  ackLauncherNotifications,
  clearPreviewIntervals,
  ensureAccountProfileScreen,
  fallbackHubLayout,
  coerceLayoutWindowConsistency,
  ensureScreenChrome,
  fetchHubLayout,
  findElementByRef,
  getActiveScreen,
  hubLayoutFingerprint,
  isHubLayout,
  normalizeLauncherChromeLayout,
  LauncherAuthError,
  pollLauncherNotifications,
  sendLiveOpsHeartbeat,
  type LiveOpsHeartbeatPayload,
  registerPreviewInterval,
  resetHubScriptRuntime,
  setHubScriptAutomationContext,
  clearScreenNavHistory,
  popScreenNavHistory,
  pushScreenNavHistory,
  resolveActionTargetScreen,
  findHubScreen,
  parseHubScreenIdFromHash,
  screenUsesDesktopWindow,
  consumeLauncherFullReload,
  resolveHomeScreenId,
  resolveLauncherStartupScreenId,
  resolveLaunchDesktopWindow,
  applyVisibilityTargetList,
  collectLaunchHudElements,
  normalizeLaunchLayout,
  LAUNCH_UI_ELEMENT_TYPES,
  hasVisibilityActions,
  isVisibilityRuleElement,
  parseVisibilityActions,
  triggersMatchingPhase,
  visibilityHideTargets,
  visibilityShowTargets,
  type LaunchAutomationPhase,
  LAUNCHER_LAST_SCREEN_KEY,
  runHubScript,
  type HubElement,
  type HubLayout,
  type LauncherSettings,
  type LauncherNotificationPayload,
  type NotificationStyle,
  type RemoteCommand,
  type ScriptRunResult,
  type ScriptRuntimeCallbacks,
} from "@craftlauncher/shared";
import { getSessionAuthApiUrl } from "./auth-api";
import { getAdminApiUrl } from "./config";
import { useAuthStore } from "./auth-store";
import {
  launchForge,
  getLauncherApi,
  isDesktopLauncher,
  isHubScreenWindow,
  navigateMainHubScreen,
  openExternalUrl,
  openHubScreenWindow,
  type MinecraftProgressPayload,
} from "./electron-api";
import { pickForgeVersionFromLayout, resolveForgeVersion } from "./forge-versions";
import { nextMilestoneWhisper, formatLaunchError } from "./launch-session-ui";
import { useLauncherDataStore } from "./launcher-data-store";
import { applyModsCatalogFromScript } from "./mods-catalog-bridge";
import {
  bindMinecraftProgressFlush,
  enqueueMinecraftProgress,
  resetMinecraftProgressThrottle,
} from "./launch-progress-throttle";
import {
  collectAnyClickWatchers,
  collectLogicElements,
  collectSelectorChangeWatchers,
  isSelectorElementType,
  runBuiltinClickAction,
  toAutomationPhase,
  triggersForPhaseChange,
} from "./hub-automation-runtime";
import { collectHubRefTargets } from "@craftlauncher/shared";
import { runLauncherSecurityScan } from "./security-scan";

const FLOATING_ALERT_MS = 7000;
const MAX_LAUNCH_LOGS = 80;
const MAX_STRUCTURED_LOGS = 400;
const NOISY_LOG = /^(classes:|assets:|Downloaded|Attempting|Using Java|\[MCLC\]:|\[CraftLauncher\])/i;
const MAX_SEEN_NOTIFICATIONS = 500;
const LAST_SCREEN_STORAGE_KEY = LAUNCHER_LAST_SCREEN_KEY;

const seenNotificationIds = new Set<string>();
const floatingTimers = new Map<string, ReturnType<typeof setTimeout>>();

let layoutSyncInFlight: Promise<void> | null = null;
let pollInFlight: Promise<void> | null = null;
let heartbeatInFlight: Promise<void> | null = null;
let cachedLauncherVersion = "1.0.0";

export type LaunchPhase =
  | "idle"
  | "checking"
  | "preparing"
  | "downloading"
  | "starting"
  | "running"
  | "error"
  | "closed";

export interface LaunchLogEntry {
  message: string;
  detail?: string;
  level: "info" | "step" | "ok" | "warn" | "error";
}

export interface LaunchMetrics {
  startedAt: number;
  lastPercent: number;
  lastPercentAt: number;
  velocityPerMin: number;
  lanes: Record<string, { current: number; total: number }>;
  lastMilestone: number;
}

export interface LaunchSession {
  visible: boolean;
  phase: LaunchPhase;
  versionLabel: string;
  message: string;
  percent: number | null;
  logs: string[];
  structuredLogs: LaunchLogEntry[];
  error: string | null;
  metrics: LaunchMetrics;
  whisper: string | null;
}

const emptyMetrics = (): LaunchMetrics => ({
  startedAt: 0,
  lastPercent: 0,
  lastPercentAt: 0,
  velocityPerMin: 0,
  lanes: {},
  lastMilestone: 0,
});

const emptyLaunchSession = (): LaunchSession => ({
  visible: false,
  phase: "idle",
  versionLabel: "",
  message: "",
  percent: null,
  logs: [],
  structuredLogs: [],
  error: null,
  metrics: emptyMetrics(),
  whisper: null,
});

export interface FloatingAlert {
  id: string;
  title: string;
  message: string;
  style: NotificationStyle;
}

export interface ModalAlert {
  id: string;
  title: string;
  message: string;
  style: NotificationStyle;
}

export interface LauncherBanner {
  id: string;
  title: string;
  message: string;
  style: NotificationStyle;
}

/** Solo datos serializables — las acciones viven en `launcherActions`. */
export interface LauncherState {
  layout: HubLayout;
  loading: boolean;
  syncError: string | null;
  lastSync: string | null;
  floatingAlerts: FloatingAlert[];
  modalAlerts: ModalAlert[];
  banners: LauncherBanner[];
  status: string;
  launchProgress: string | null;
  launchSession: LaunchSession;
  /** Variantes A/B activas (key → A|B), sincronizadas por heartbeat. */
  experimentVariants: Record<string, "A" | "B">;
  /** Recompensas sincronizadas desde el admin. */
  rewardPoints: number;
  rewardTier: string | null;
}

function cloneLayout(layout: HubLayout): HubLayout {
  return JSON.parse(JSON.stringify(layout)) as HubLayout;
}

const OFFLINE_LAYOUT_MSG = "Sin conexión — usando la última configuración guardada";

type HubLayoutCacheRecord = {
  savedAt: string | null;
  fingerprint: string;
  layout: HubLayout;
};

async function readHubLayoutCacheRecord(): Promise<HubLayoutCacheRecord | null> {
  const raw = await getLauncherApi()?.readHubLayoutCache?.();
  if (!raw?.layout || !isHubLayout(raw.layout)) return null;
  return {
    savedAt: raw.savedAt ?? null,
    fingerprint: raw.fingerprint ?? hubLayoutFingerprint(raw.layout),
    layout: raw.layout,
  };
}

async function persistHubLayoutCache(layout: HubLayout): Promise<void> {
  try {
    await getLauncherApi()?.writeHubLayoutCache?.(layout);
  } catch {
    /* ignore — caché opcional fuera de escritorio */
  }
}

/** En ventanas `#/hub-screen/{id}` la pantalla activa debe seguir el hash, no Inicio. */
function resolveLayoutActiveScreenId(layout: HubLayout): string {
  if (typeof window !== "undefined") {
    const hubScreenId = parseHubScreenIdFromHash(window.location.hash);
    if (hubScreenId && layout.screens.some((s) => s.id === hubScreenId)) {
      return hubScreenId;
    }
    if (consumeLauncherFullReload()) {
      return resolveHomeScreenId(layout);
    }
  }
  return resolveLauncherStartupScreenId(
    layout,
    typeof window !== "undefined"
      ? () => {
          try {
            return localStorage.getItem(LAST_SCREEN_STORAGE_KEY);
          } catch {
            return null;
          }
        }
      : undefined
  );
}

async function applyElectronWindowFromLayout(layout: HubLayout) {
  const api = getLauncherApi();
  if (!api?.saveSettings) return;

  const borderless = Boolean(layout.window?.borderlessFullscreen);

  if (borderless) {
    const area = await api.getDisplayWorkArea?.();
    if (!area || area.width < 320 || area.height < 200) return;

    setState({
      layout: {
        ...layout,
        window: {
          ...layout.window,
          width: area.width,
          height: area.height,
          lockSize: true,
          borderlessFullscreen: true,
        },
      },
    });

    await api.saveSettings({
      window: {
        width: area.width,
        height: area.height,
        lockSize: true,
        borderlessFullscreen: true,
      },
    } as Partial<LauncherSettings>);
    return;
  }

  const w = layout.window?.width;
  const h = layout.window?.height;
  if (typeof w !== "number" || typeof h !== "number" || w < 320 || h < 200) return;

  await api.saveSettings({
    window: {
      width: Math.round(w),
      height: Math.round(h),
      lockSize: Boolean(layout.window?.lockSize),
      borderlessFullscreen: false,
    },
  } as Partial<LauncherSettings>);
}

async function applyHubLayoutToLauncher(
  layout: HubLayout,
  opts?: {
    lastSync?: string;
    syncError?: string | null;
    skipRuntimeReset?: boolean;
    /** Sync en caliente: conserva la ventana actual si sigue existiendo. */
    preserveActiveScreen?: boolean;
  }
) {
  const phase = getState().launchSession.phase;
  const resetLaunchVisibility = phase === "idle" || phase === "closed";
  const previousScreenId = getState().layout.activeScreenId;
  let next = cloneLayout(
    normalizeLaunchLayout(
      normalizeLauncherChromeLayout(coerceLayoutWindowConsistency(layout)),
      { resetLaunchVisibility }
    )
  );
  next = ensureAccountProfileScreen(next);
  await applyElectronWindowFromLayout(next);
  if (!opts?.skipRuntimeReset) {
    resetHubScriptRuntime();
    clearPreviewIntervals();
    if (!opts?.preserveActiveScreen) {
      clearScreenNavHistory();
    }
  }
  const activeScreenId =
    opts?.preserveActiveScreen &&
    previousScreenId &&
    next.screens.some((s) => s.id === previousScreenId)
      ? previousScreenId
      : resolveLayoutActiveScreenId(next);
  next = { ...next, activeScreenId };
  setState({
    layout: next,
    loading: false,
    lastSync: opts?.lastSync ?? new Date().toISOString(),
    syncError: opts?.syncError ?? null,
  });
  launcherActions.runScreenSetup();
  void persistHubLayoutCache(next);
}

function useOfflineLayout(
  cache: HubLayoutCacheRecord,
  message: string | null = OFFLINE_LAYOUT_MSG,
  opts?: { preserveActiveScreen?: boolean }
) {
  return applyHubLayoutToLauncher(cache.layout, {
    lastSync: cache.savedAt ?? undefined,
    syncError: message,
    skipRuntimeReset: hubLayoutFingerprint(getState().layout) === cache.fingerprint,
    preserveActiveScreen: opts?.preserveActiveScreen,
  });
}

const launcherStore = createStore<LauncherState>(() => ({
  layout: cloneLayout(fallbackHubLayout),
  loading: true,
  syncError: null,
  lastSync: null,
  floatingAlerts: [],
  modalAlerts: [],
  banners: [],
  status: "idle",
  launchProgress: null,
  launchSession: emptyLaunchSession(),
  experimentVariants: {},
  rewardPoints: 0,
  rewardTier: null,
}));

export const useLauncherStore = <T,>(selector: (state: LauncherState) => T) =>
  useStore(launcherStore, selector);

function getState() {
  return launcherStore.getState();
}

function persistLaunchSession(session: LaunchSession) {
  if (session.phase === "idle") return;
  const api = getLauncherApi();
  void api?.saveLaunchLog?.({
    versionLabel: session.versionLabel,
    message: session.message,
    phase: session.phase,
    percent: session.percent,
    logs: session.logs,
    structuredLogs: session.structuredLogs,
    metrics: session.metrics,
  });
}

function setState(partial: Partial<LauncherState> | ((state: LauncherState) => Partial<LauncherState>)) {
  launcherStore.setState(partial);
}

function sessionFromPersisted(saved: {
  versionLabel?: string;
  message?: string;
  phase?: string;
  percent?: number | null;
  logs?: string[];
  structuredLogs?: LaunchLogEntry[];
  metrics?: LaunchMetrics;
}): LaunchSession {
  let phase = (saved.phase as LaunchPhase) || "closed";
  if (phase === "checking" || phase === "preparing" || phase === "downloading" || phase === "starting") {
    phase = "closed";
  }
  if (phase === "running") {
    phase = "closed";
  }
  return {
    visible: false,
    phase,
    versionLabel: saved.versionLabel ?? "",
    message: saved.message ?? "",
    percent: saved.percent ?? null,
    logs: saved.logs ?? [],
    structuredLogs: saved.structuredLogs ?? [],
    error: null,
    metrics: saved.metrics ?? emptyMetrics(),
    whisper: null,
  };
}

function buildScriptCallbacks(
  runAtDepth: (id: string, depth: number) => Promise<ScriptRunResult | null>
): ScriptRuntimeCallbacks {
  return {
    updateElement: (elId: string, patch: Partial<HubElement>) => launcherActions.updateElement(elId, patch),
    getElementById: (elId: string) => findElementInLayout(getState().layout, elId),
    getElementByRef: (refId: string) => {
      const layout = getState().layout;
      for (const screen of layout.screens) {
        const hit = findElementByRef(screen, refId);
        if (hit) return hit;
        const chromeHit = screen.chrome?.elements?.find((e) => e.logic?.refId === refId);
        if (chromeHit) return chromeHit;
      }
      return layout.launcherChrome?.elements?.find((e) => e.logic?.refId === refId) ?? null;
    },
    getAllElements: () => {
      const layout = getState().layout;
      return [
        ...layout.screens.flatMap((s) => [...s.elements, ...(s.chrome?.elements ?? [])]),
        ...(layout.launcherChrome?.elements ?? []),
      ];
    },
    getActiveScreenId: () => getState().layout.activeScreenId,
    setActiveScreen: (screenId: string) => launcherActions.navigateToHubScreen(screenId),
    goBackScreen: () => launcherActions.goBackScreen(),
    runLogicByRef: (refId: string, d: number) => {
      const other = findElementByRef(getActiveScreen(getState().layout), refId);
      return other ? runAtDepth(other.id, d) : Promise.resolve(null);
    },
    runLogicById: (elId: string, d: number) => runAtDepth(elId, d),
    onEmit: (event: string, data?: unknown) => {
      if (event === "toast" && data && typeof data === "object" && "message" in data) {
        launcherActions.pushFloatingAlert({
          id: `script-${Date.now()}`,
          title: "Hub",
          message: String((data as { message: string }).message),
          style: "info",
        });
      }
      if (event === "desktop" && data && typeof data === "object" && "action" in data) {
        const api = getLauncherApi();
        const action = String((data as { action: string }).action);
        const targetRef = "targetRef" in data ? String((data as { targetRef?: string }).targetRef ?? "") : "";
        const valueRef = "valueRef" in data ? String((data as { valueRef?: string }).valueRef ?? "") : "";
        const patch =
          "patch" in data && (data as { patch?: unknown }).patch && typeof (data as { patch?: unknown }).patch === "object"
            ? ((data as { patch: Record<string, unknown> }).patch as Record<string, unknown>)
            : null;
        void (async () => {
          try {
            if (!api) throw new Error("API desktop no disponible");
            if (action === "pickDataDir") {
              const result = await api.pickDataDir?.();
              if (!result?.dataDir) return;
              if (targetRef) {
                const el = findElementByRef(getActiveScreen(getState().layout), targetRef);
                if (el) launcherActions.updateElement(el.id, { value: result.dataDir, label: el.label });
              }
              return;
            }
            if (action === "saveDataDir") {
              const ref = valueRef || targetRef;
              const el = ref ? findElementByRef(getActiveScreen(getState().layout), ref) : null;
              const dataDir = String(el?.value ?? "").trim();
              if (!dataDir) throw new Error("Ruta vacía");
              await api.saveSettings?.({ dataDir });
              launcherActions.pushFloatingAlert({
                id: `settings-${Date.now()}`,
                title: "Ajustes",
                message: "Carpeta guardada",
                style: "success",
              });
              return;
            }
            if (action === "saveSettings") {
              if (!patch) throw new Error("Patch inválido");
              await api.saveSettings?.(patch);
              launcherActions.pushFloatingAlert({
                id: `settings-${Date.now()}`,
                title: "Ajustes",
                message: "Guardado",
                style: "success",
              });
              return;
            }
          } catch (err) {
            launcherActions.pushFloatingAlert({
              id: `desktop-${Date.now()}`,
              title: "Ajustes",
              message: err instanceof Error ? err.message : String(err),
              style: "error",
            });
          }
        })();
      }
      if (event === "mods-catalog" && data && typeof data === "object") {
        applyModsCatalogFromScript(data);
        return;
      }
      if (event === "navigate" && data && typeof data === "object") {
        if ("back" in data && (data as { back?: boolean }).back) {
          launcherActions.goBackScreen();
          return;
        }
        if ("screen" in data) {
          launcherActions.navigateToHubScreen(String((data as { screen: string }).screen));
        }
      }
      if (event === "instance" && data && typeof data === "object" && "action" in data) {
        const payload = data as { action: string; name?: string; mcVersion?: string; id?: string };
        const store = useLauncherDataStore.getState();
        void (async () => {
          try {
            if (payload.action === "create") {
              const mcVersion = String(payload.mcVersion ?? "1.20.1").trim() || "1.20.1";
              const name = String(payload.name ?? "").trim();
              await store.createInstance({ name: name || mcVersion, mcVersion, loader: "forge" });
              store.resetInstanceDraft();
              launcherActions.pushFloatingAlert({
                id: `inst-${Date.now()}`,
                title: "Perfil creado",
                message: name || mcVersion,
                style: "success",
              });
            } else if (payload.action === "select" && payload.id) {
              await store.selectInstance(String(payload.id));
            } else if (payload.action === "delete" && payload.id) {
              await store.deleteInstance(String(payload.id));
            }
          } catch (err) {
            launcherActions.pushFloatingAlert({
              id: `inst-err-${Date.now()}`,
              title: "Perfiles",
              message: err instanceof Error ? err.message : String(err),
              style: "error",
            });
          }
        })();
      }
    },
  };
}

function findElementInLayout(layout: HubLayout, elementId: string): HubElement | null {
  for (const screen of layout.screens) {
    const chromeHit = screen.chrome?.elements?.find((e) => e.id === elementId);
    if (chromeHit) return chromeHit;
    const hit = screen.elements.find((e) => e.id === elementId);
    if (hit) return hit;
  }
  return layout.launcherChrome?.elements?.find((e) => e.id === elementId) ?? null;
}

function patchVisibleByRef(refId: string, visible: boolean) {
  const id = refId.trim();
  if (!id) return;
  applyVisibilityTargetList(getState().layout, [id], visible, (elementId, v) => {
    launcherActions.updateElement(elementId, { visible: v });
  });
}

function patchVisibleByTargets(targets: string[], visible: boolean) {
  if (!targets.length) return;
  applyVisibilityTargetList(getState().layout, targets, visible, (elementId, v) => {
    launcherActions.updateElement(elementId, { visible: v });
  });
}

/** Si el layout no tiene refId barraProgreso, muestra barras de lanzamiento por tipo. */
function showLaunchHudFallback() {
  const screen = getActiveScreen(getState().layout);
  for (const el of screen.elements) {
    if (el.type === "launch-progress-bar" || el.type === "launch-phase-label") {
      launcherActions.updateElement(el.id, { visible: true });
    }
  }
}

async function runAtDepth(targetId: string, depth: number): Promise<ScriptRunResult | null> {
  const target = findElementInLayout(getState().layout, targetId);
  if (!target?.logic?.enabled) return null;

  if (isVisibilityRuleElement(target)) {
    applyVisibilityRule(target);
    if (!target.logic.script.trim()) {
      return { success: true, message: "Visibilidad actualizada", logs: [] };
    }
  }

  if (!target.logic.script.trim()) return null;
  return runHubScript(target, target.logic.script, buildScriptCallbacks(runAtDepth), depth);
}

function reconcileLaunchVisibilityRules() {
  const phase = toAutomationPhase(getState().launchSession.phase) as LaunchAutomationPhase;
  const matchers = triggersMatchingPhase(phase);
  if (!matchers.length) return;
  setHubScriptAutomationContext({ launchPhase: getState().launchSession.phase });
  for (const el of collectLogicElements(getState().layout)) {
    if (!isVisibilityRuleElement(el)) continue;
    const trigger = el.logic?.trigger;
    if (!trigger || !matchers.includes(trigger)) continue;
    applyVisibilityRule(el);
  }
}

async function dispatchLaunchPhaseAutomation(prev: LaunchPhase, next: LaunchPhase) {
  if (prev === next) return;
  setHubScriptAutomationContext({ launchPhase: next, clickedElementId: null });
  const fired = triggersForPhaseChange(toAutomationPhase(prev), toAutomationPhase(next));
  for (const el of collectLogicElements(getState().layout)) {
    const trigger = el.logic?.trigger;
    if (!trigger || !fired.includes(trigger)) continue;
    await runAtDepth(el.id, 0);
  }
  reconcileLaunchVisibilityRules();
}

function applyVisibilityRule(el: HubElement) {
  if (el.type === "hide-on-condition") {
    patchVisibleByTargets(visibilityHideTargets(el), false);
    return;
  }
  patchVisibleByTargets(visibilityShowTargets(el), true);
  patchVisibleByTargets(visibilityHideTargets(el), false);
}

function applyShowHideFromConstants(el: HubElement) {
  if (isVisibilityRuleElement(el)) {
    applyVisibilityRule(el);
    return;
  }
  for (const action of parseVisibilityActions(el.logic?.constants)) {
    patchVisibleByTargets([action.target], action.op === "show");
  }
}

/** Respeta VIS_ACTIONS del botón Jugar (no muestra todo el HUD). */
function applyPlayLaunchVisibility() {
  const layout = getState().layout;
  const screen = getActiveScreen(layout);
  const playEls = screen.elements.filter(
    (e) => e.action === "play" || e.type === "play-button" || e.type === "play-show-bind"
  );
  let applied = false;
  const shown = new Set<string>();
  for (const btn of playEls) {
    if (!hasVisibilityActions(btn)) continue;
    for (const action of parseVisibilityActions(btn.logic?.constants)) {
      if (action.op === "show") shown.add(action.target);
    }
    applyShowHideFromConstants(btn);
    applied = true;
  }
  if (!applied) {
    patchVisibleByTargets(["barraProgreso", "faseLanzamiento"], true);
    showLaunchHudFallback();
  } else {
    if (shown.has("barraProgreso") || [...shown].some((t) => t.includes("barraProgreso"))) {
      patchVisibleByTargets(["barraProgreso", "faseLanzamiento"], true);
      showLaunchHudFallback();
    }
  }
  for (const panel of screen.elements.filter((e) => e.type === "launch-panel")) {
    const anyVisible = screen.elements.some((e) => e.parentId === panel.id && e.visible);
    if (anyVisible && !panel.visible) launcherActions.updateElement(panel.id, { visible: true });
  }
}

function hideLaunchHudOnIdle() {
  if (getState().launchSession.phase !== "idle" && getState().launchSession.phase !== "closed") return;
  const layout = getState().layout;
  for (const screen of layout.screens) {
    for (const el of screen.elements) {
      if (!LAUNCH_UI_ELEMENT_TYPES.has(el.type) && el.type !== "launch-panel") continue;
      if (el.visible) launcherActions.updateElement(el.id, { visible: false });
    }
  }
}

async function dispatchSelectorChangeAutomation(source: HubElement, value: string | number | boolean) {
  setHubScriptAutomationContext({
    launchPhase: getState().launchSession.phase,
    selectorElementId: source.id,
    selectorRef: source.logic?.refId ?? null,
    selectorValue: value,
    clickedElementId: null,
  });
  for (const el of collectSelectorChangeWatchers(getState().layout, source.logic?.refId)) {
    await runAtDepth(el.id, 0);
  }
}

async function dispatchAnyClickAutomation(clickedElementId: string) {
  const layout = getState().layout;
  const screenId = layout.activeScreenId;
  setHubScriptAutomationContext({
    launchPhase: getState().launchSession.phase,
    clickedElementId,
  });
  for (const el of collectAnyClickWatchers(layout, screenId)) {
    if (el.id === clickedElementId) continue;
    await runAtDepth(el.id, 0);
  }
}

export const launcherActions = {
  /** Oculta la ventana de progreso (no detiene Minecraft ni el log en memoria). */
  hideLaunchPanel: () => {
    setState((s) => {
      if (s.launchSession.phase === "idle") return s;
      const launchSession = { ...s.launchSession, visible: false };
      persistLaunchSession(launchSession);
      if (isDesktopLauncher()) {
        void getLauncherApi()?.closeLaunchProgress?.();
      }
      return { launchSession };
    });
  },

  setLayoutUi: (patch: Partial<NonNullable<HubLayout["ui"]>>) => {
    setState((s) => {
      const layout: HubLayout = { ...s.layout, ui: { ...s.layout.ui, ...patch } };
      void persistHubLayoutCache(layout);
      let launchSession = s.launchSession;
      if (patch.launchDesktopWindow === true && launchSession.phase !== "idle") {
        launchSession = { ...launchSession, visible: true };
        openLaunchProgressWindowIfNeeded(launchSession);
      }
      if (patch.launchDesktopWindow === false && launchSession.phase !== "idle") {
        void getLauncherApi()?.closeLaunchProgress?.();
        launchSession = { ...launchSession, visible: false };
      }
      return { layout, launchSession };
    });
  },

  /** Solo estado UI (p. ej. el usuario cerró la ventana de progreso con Alt+F4). */
  syncLaunchPanelHidden: () => {
    setState((s) => {
      if (s.launchSession.phase === "idle" || !s.launchSession.visible) return s;
      const launchSession = { ...s.launchSession, visible: false };
      persistLaunchSession(launchSession);
      return { launchSession };
    });
  },

  showLaunchPanel: () => {
    setState((s) => {
      if (s.launchSession.phase === "idle") return s;
      const launchSession = { ...s.launchSession, visible: true };
      openLaunchProgressWindowIfNeeded(launchSession);
      return { launchSession };
    });
  },

  /** Solo oculta el modal; el log se conserva en memoria y en disco. */
  applyPanelVisibilitySelect: async (
    elementId: string,
    refId: string,
    opts?: { hideOthers?: boolean }
  ) => {
    const show = refId.trim();
    if (!show) return;
    launcherActions.updateElement(elementId, { value: show });
    patchVisibleByRef(show, true);
    if (opts?.hideOthers) {
      for (const t of collectHubRefTargets(getState().layout)) {
        if (t.refId !== show) patchVisibleByRef(t.refId, false);
      }
    }
    const el = findElementInLayout(getState().layout, elementId);
    if (el?.logic?.enabled && el.logic.script.trim() && el.logic.trigger === "change") {
      await launcherActions.runElementLogic(elementId);
    }
  },

  dismissLaunchPanel: () => {
    launcherActions.hideLaunchPanel();
  },

  restoreLaunchLog: async () => {
    const api = getLauncherApi();
    const saved = await api?.loadLaunchLog?.();
    if (!saved) return;
    const current = getState().launchSession;
    if (current.phase !== "idle") return;

    const session = sessionFromPersisted(saved as Parameters<typeof sessionFromPersisted>[0]);
    if (!session.logs.length && !session.structuredLogs.length) return;

    setState({
      launchSession: { ...session, visible: false },
      launchProgress: session.message || null,
    });
    hideLaunchHudOnIdle();
  },

  handleMinecraftProgress: (payload: MinecraftProgressPayload) => {
    enqueueMinecraftProgress(payload);
  },

  applyMinecraftProgress: (payload: MinecraftProgressPayload) => {
    const stage = payload.stage ?? "";
    const message = payload.message ?? "";
    const now = Date.now();

    setState((s) => {
      const sessionActive = s.launchSession.phase !== "idle";
      if (!sessionActive) return s;

      const logs = [...s.launchSession.logs];
      const structuredLogs = [...s.launchSession.structuredLogs];
      let metrics = { ...s.launchSession.metrics, lanes: { ...s.launchSession.metrics.lanes } };
      let whisper = s.launchSession.whisper;

      if (stage === "install-log" && message) {
        const level = (payload.level as LaunchLogEntry["level"]) ?? "step";
        const isAssetProgress = /^[\w-]+:\s*\d+\/\d+$/i.test(message);
        const isRunningNoise =
          s.launchSession.phase === "running" &&
          level === "error" &&
          (/^error de lanzamiento$/i.test(message) ||
            /Failed to load resource|ShaderInstance|could not find sampler/i.test(message));
        if (!isAssetProgress && !isRunningNoise) {
          structuredLogs.push({
            message,
            detail: payload.detail ? String(payload.detail) : undefined,
            level,
          });
          if (structuredLogs.length > MAX_STRUCTURED_LOGS) {
            structuredLogs.splice(0, structuredLogs.length - MAX_STRUCTURED_LOGS);
          }
        }
      }

      if (message && (stage === "log" || stage === "debug")) {
        if (!NOISY_LOG.test(message) && !logs.includes(message)) logs.push(message);
        if (logs.length > MAX_LAUNCH_LOGS) logs.splice(0, logs.length - MAX_LAUNCH_LOGS);
      }

      const progressType = payload.type ? String(payload.type).toLowerCase() : null;
      const progressCurrent = Number(payload.current ?? payload.task) || 0;
      const progressTotal = Number(payload.total) || 0;
      if (progressType && progressTotal > 0) {
        metrics.lanes[progressType] = { current: progressCurrent, total: progressTotal };
      }

      const nextPercent = payload.percent ?? s.launchSession.percent;
      if (nextPercent != null && metrics.startedAt > 0) {
        const elapsedMin = Math.max(0.05, (now - metrics.lastPercentAt) / 60_000);
        if (metrics.lastPercentAt > 0 && nextPercent > metrics.lastPercent) {
          const delta = nextPercent - metrics.lastPercent;
          const instant = delta / elapsedMin;
          metrics.velocityPerMin = metrics.velocityPerMin
            ? metrics.velocityPerMin * 0.65 + instant * 0.35
            : instant;
        }
        if (nextPercent !== metrics.lastPercent) {
          metrics.lastPercent = nextPercent;
          metrics.lastPercentAt = now;
        }
        const milestone = nextMilestoneWhisper(nextPercent, metrics.lastMilestone);
        if (milestone.whisper) {
          whisper = milestone.whisper;
          metrics.lastMilestone = milestone.milestone;
        }
      }

      const desktopWin = resolveLaunchDesktopWindow(s.layout);
      const popIn =
        desktopWin && !s.launchSession.visible && (stage === "error" || stage === "launched");

      if (stage === "error") {
        const launchSession = {
          ...s.launchSession,
          visible: true,
          phase: "error" as const,
          message: "No se pudo lanzar Minecraft",
          error: formatLaunchError(message || s.launchSession.error || ""),
          logs,
          structuredLogs,
          metrics,
          whisper,
        };
        persistLaunchSession(launchSession);
        return {
          status: "idle",
          launchProgress: message,
          launchSession,
        };
      }

      if (stage === "launched") {
        const gameLogs = [...structuredLogs];
        gameLogs.push({
          message: message || "Minecraft iniciado — registro en vivo",
          level: "ok",
        });
        if (gameLogs.length > MAX_STRUCTURED_LOGS) {
          gameLogs.splice(0, gameLogs.length - MAX_STRUCTURED_LOGS);
        }
        const launchSession = {
          ...s.launchSession,
          visible: popIn || s.launchSession.visible,
          phase: "running" as const,
          message: message || "Minecraft en ejecución — registro en vivo abajo",
          percent: 100,
          logs,
          structuredLogs: gameLogs,
          error: null,
          metrics,
          whisper: null,
        };
        persistLaunchSession(launchSession);
        return {
          status: "running",
          launchProgress: message,
          launchSession,
        };
      }

      if (stage === "close") {
        const exitCode = typeof payload.code === "number" ? payload.code : 0;
        const crashed = exitCode !== 0;
        const closeMsg = message || (crashed ? `Minecraft terminó con código ${exitCode}` : "Minecraft cerrado");
        const closedLogs = [...structuredLogs];
        if (!closedLogs.some((e) => e.message === closeMsg)) {
          closedLogs.push({ message: closeMsg, level: crashed ? "error" : "info" });
        }

        if (crashed) {
          const launchSession = {
            ...s.launchSession,
            visible: true,
            phase: "error" as const,
            message: "No se pudo mantener Minecraft en ejecución",
            error: formatLaunchError(closeMsg),
            logs,
            structuredLogs: closedLogs,
            metrics,
            whisper,
          };
          persistLaunchSession(launchSession);
          return {
            status: "idle",
            launchProgress: closeMsg,
            launchSession,
          };
        }

        const launchSession = {
          ...s.launchSession,
          visible: false,
          phase: "closed" as const,
          message: closeMsg,
          percent: s.launchSession.percent ?? 100,
          logs,
          structuredLogs: closedLogs,
          error: null,
          metrics,
          whisper,
        };
        persistLaunchSession(launchSession);
        return {
          status: "idle",
          launchProgress: closeMsg,
          launchSession,
        };
      }

      if (s.launchSession.phase === "running" && (stage === "progress" || stage === "downloading")) {
        return {
          launchSession: {
            ...s.launchSession,
            logs,
            structuredLogs,
            percent: s.launchSession.percent ?? 100,
            metrics,
            whisper,
          },
        };
      }

      let phase = s.launchSession.phase;
      if (stage === "checking" || stage === "java-ok") phase = "checking";
      else if (stage === "start") phase = "preparing";
      else if (stage === "starting") phase = "starting";
      else if (stage === "downloading" || stage === "progress") phase = "downloading";

      if (
        phase === "downloading" &&
        message &&
        /minecraft en ejecución/i.test(message)
      ) {
        phase = "running";
      }

      const displayMessage =
        stage === "log" || stage === "debug" || stage === "install-log"
          ? s.launchSession.message
          : message || s.launchSession.message;

      const versionLabel =
        payload.versionLabel && typeof payload.versionLabel === "string"
          ? payload.versionLabel
          : s.launchSession.versionLabel;

      const percentForPhase =
        phase === "starting"
          ? Math.max(nextPercent ?? 0, s.launchSession.percent ?? 0, 90)
          : phase === "running"
            ? 100
            : nextPercent ?? s.launchSession.percent;

      const launchSession = {
        ...s.launchSession,
        visible: popIn ? true : s.launchSession.visible,
        phase,
        versionLabel,
        message: displayMessage,
        percent: percentForPhase,
        logs,
        structuredLogs,
        error: s.launchSession.error,
        metrics,
        whisper,
      };

      if (phase === "downloading" && structuredLogs.length % 24 === 0) {
        persistLaunchSession(launchSession);
      }

      return {
        launchProgress: displayMessage,
        status: s.status === "idle" && phase !== "idle" ? "launching" : s.status,
        launchSession,
      };
    });
  },

  launchMinecraftForge: async (versionId: string) => {
    if (getState().status === "launching") return;

    const api = getLauncherApi();
    if (!api?.launchForge && !api?.launchMinecraft) {
      launcherActions.pushFloatingAlert({
        id: `play-err-${Date.now()}`,
        title: "Solo escritorio",
        message: "Abre CraftLauncher con npm run launcher:dev (no el navegador).",
        style: "error",
      });
      return;
    }

    const layout = getState().layout;
    const screen = getActiveScreen(layout);
    const dataStore = useLauncherDataStore.getState();

    let targetInstanceId =
      dataStore.activeInstance?.id ??
      screen.elements.find((e) => e.type === "instance-selector")?.value?.toString() ??
      "";

    const selectorEl = screen.elements.find(
      (e) => e.type === "instance-selector" || e.logic?.refId === "instance.active"
    );
    if (selectorEl?.value) targetInstanceId = String(selectorEl.value);

    if (targetInstanceId) {
      try {
        await dataStore.selectInstance(targetInstanceId);
      } catch {
        /* launch will use electron active instance */
      }
    }

    let instance = useLauncherDataStore.getState().activeInstance;
    let resolvedVersion = versionId;
    if (api?.getActiveInstance) {
      try {
        const active = await api.getActiveInstance();
        if (active.instance) {
          instance = active.instance;
          resolvedVersion = active.instance.mcVersion;
        }
      } catch {
        /* use layout version */
      }
    }

    const cfg = resolveForgeVersion(resolvedVersion);
    const versionLabel = instance
      ? `${instance.name} · ${instance.mcVersion} Forge`
      : cfg.label;

    const baseStructured: LaunchLogEntry[] = [
      {
        message: "Nuevo lanzamiento…",
        detail: versionLabel,
        level: "info",
      },
    ];

    const desktopWin = resolveLaunchDesktopWindow(getState().layout);
    const launchSession: LaunchSession = {
      visible: desktopWin,
      phase: "checking",
      versionLabel,
      message: "Comprobando Java y preparando lanzamiento…",
      percent: null,
      logs: [],
      structuredLogs: baseStructured,
      error: null,
      metrics: { ...emptyMetrics(), startedAt: Date.now(), lastPercentAt: Date.now() },
      whisper: null,
    };

    setState({
      status: "launching",
      launchProgress: `Preparando ${versionLabel}…`,
      launchSession,
    });

    applyPlayLaunchVisibility();
    reconcileLaunchVisibilityRules();
    openLaunchProgressWindowIfNeeded(launchSession);
    resetMinecraftProgressThrottle();

    const modpackReady = await useLauncherDataStore.getState().ensureModpackForPlay();
    if (!modpackReady) {
      const errMsg = useLauncherDataStore.getState().error ?? "No se pudo instalar el modpack";
      setState({
        status: "idle",
        launchProgress: errMsg,
        launchSession: {
          ...getState().launchSession,
          visible: true,
          phase: "error",
          message: "Instalación del modpack fallida",
          error: errMsg,
        },
      });
      launcherActions.pushFloatingAlert({
        id: `play-install-${Date.now()}`,
        title: "Modpack",
        message: errMsg,
        style: "error",
      });
      return;
    }

    instance = useLauncherDataStore.getState().activeInstance ?? instance;
    if (instance) {
      resolvedVersion = instance.mcVersion;
      launchSession.versionLabel = `${instance.name} · ${instance.mcVersion} Forge`;
      setState({ launchSession: { ...launchSession, versionLabel: launchSession.versionLabel } });
    }

    try {
      const result = await launchForge(
        resolvedVersion,
        instance?.id ?? (targetInstanceId || null)
      );
      if (result && typeof result === "object" && "ok" in result && !result.ok) {
        throw new Error(
          typeof (result as { error?: string }).error === "string"
            ? (result as { error: string }).error
            : "No se pudo iniciar el lanzamiento"
        );
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "No se pudo iniciar Minecraft";
      const msg = formatLaunchError(raw);
      setState((s) => {
        const launchSession = {
          ...s.launchSession,
          visible: true,
          phase: "error" as const,
          message: "No se pudo lanzar Minecraft",
          error: msg,
        };
        persistLaunchSession(launchSession);
        return {
          status: "idle",
          launchProgress: msg,
          launchSession,
        };
      });
      launcherActions.pushFloatingAlert({
        id: `play-err-${Date.now()}`,
        title: "Error al lanzar",
        message: msg,
        style: "error",
      });
    }
  },

  pushFloatingAlert: (alert: FloatingAlert) => {
    setState((s) => {
      if (s.floatingAlerts.some((a) => a.id === alert.id)) return s;
      return { floatingAlerts: [...s.floatingAlerts, alert].slice(-5) };
    });

    const prev = floatingTimers.get(alert.id);
    if (prev) clearTimeout(prev);
    floatingTimers.set(
      alert.id,
      setTimeout(() => {
        floatingTimers.delete(alert.id);
        launcherActions.dismissFloatingAlert(alert.id);
      }, FLOATING_ALERT_MS)
    );
  },

  dismissFloatingAlert: (id: string) => {
    const t = floatingTimers.get(id);
    if (t) clearTimeout(t);
    floatingTimers.delete(id);
    setState((s) => ({ floatingAlerts: s.floatingAlerts.filter((a) => a.id !== id) }));
  },

  dismissModalAlert: (id: string) => setState((s) => ({ modalAlerts: s.modalAlerts.filter((a) => a.id !== id) })),

  dismissBanner: (id: string) => setState((s) => ({ banners: s.banners.filter((b) => b.id !== id) })),

  pushNotification: (payload: LauncherNotificationPayload) => {
    const style = payload.style ?? "info";
    const display = payload.display ?? "toast";

    if (display === "alert") {
      setState((s) => {
        if (s.modalAlerts.some((a) => a.id === payload.id)) return s;
        return {
          modalAlerts: [
            ...s.modalAlerts,
            { id: payload.id, title: payload.title, message: payload.message, style },
          ],
        };
      });
      return;
    }

    if (display === "banner") {
      setState((s) => ({
        banners: [
          { id: payload.id, title: payload.title, message: payload.message, style },
          ...s.banners.filter((b) => b.id !== payload.id),
        ].slice(0, 2),
      }));
      return;
    }

    launcherActions.pushFloatingAlert({
      id: payload.id,
      title: payload.title,
      message: payload.message,
      style,
    });
  },

  setLauncherVersion: (version: string) => {
    if (version.trim()) cachedLauncherVersion = version.trim();
  },

  buildLiveOpsPayload: (): LiveOpsHeartbeatPayload => {
    const s = getState();
    const phase = s.launchSession.phase;
    let status: LiveOpsHeartbeatPayload["status"] = "online";
    if (s.status === "running" || phase === "running") status = "playing";
    else if (
      s.status === "launching" ||
      phase === "checking" ||
      phase === "preparing" ||
      phase === "downloading" ||
      phase === "starting"
    ) {
      status = "launching";
    } else if (s.loading) status = "updating";
    else if (s.status === "idle" && phase === "idle") status = "idle";

    const perfMem = performance as Performance & {
      memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
    };
    const ramUsage = perfMem.memory
      ? Math.round((perfMem.memory.usedJSHeapSize / perfMem.memory.jsHeapSizeLimit) * 100)
      : status === "playing"
        ? 55
        : 18;

    const cpuUsage =
      status === "playing" ? 48 : status === "launching" ? 72 : status === "updating" ? 35 : 8;

    return {
      status,
      launcherVersion: cachedLauncherVersion,
      minecraftVersion: s.launchSession.versionLabel || undefined,
      os:
        typeof navigator !== "undefined"
          ? `${navigator.platform}`.replace(/^Win/, "Windows ")
          : "Unknown",
      ramUsage,
      cpuUsage,
      timezone:
        typeof Intl !== "undefined"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : undefined,
      locale: typeof navigator !== "undefined" ? navigator.language : undefined,
    };
  },

  sendHeartbeat: async () => {
    if (heartbeatInFlight) return heartbeatInFlight;
    if (useAuthStore.getState().status !== "ready") return;

    const run = (async () => {
      let headers = await useAuthStore.getState().resolveHeaders(true);
      if (!headers) return;

      const sessionApi = getSessionAuthApiUrl();
      let result = await sendLiveOpsHeartbeat(
        sessionApi,
        headers,
        launcherActions.buildLiveOpsPayload()
      );

      if (result.unauthorized) {
        headers = await useAuthStore.getState().resolveHeaders(true);
        if (headers) {
          result = await sendLiveOpsHeartbeat(
            getSessionAuthApiUrl(),
            headers,
            launcherActions.buildLiveOpsPayload()
          );
        }
      }

      if (result.unauthorized || result.error || !result.ok) return;

      if (result.experiments) {
        setState({ experimentVariants: result.experiments });
      }

      if (result.config) {
        const cfg = result.config as {
          maintenanceMode?: boolean;
          maintenanceMessage?: string;
          minLauncherVersion?: string;
        };
        if (cfg.maintenanceMode) {
          launcherActions.pushFloatingAlert({
            id: `maint_${Date.now()}`,
            title: "Mantenimiento",
            message: cfg.maintenanceMessage ?? "Servidor en mantenimiento",
            style: "warning",
          });
        }
      }

      if (result.rewards) {
        const rw = result.rewards as {
          profile?: { points?: number; tierName?: string };
          missions?: Array<{ title: string; completed: boolean; progress: number; target: number; rewardPoints: number }>;
        };
        if (rw.profile?.tierName) {
          setState({ rewardTier: rw.profile.tierName, rewardPoints: rw.profile.points ?? 0 });
        }
      }

      void runLauncherSecurityScan();

      for (const cmd of result.commands) {
        launcherActions.applyRemoteCommand(cmd);
      }
    })();

    heartbeatInFlight = run;
    try {
      await run;
    } finally {
      if (heartbeatInFlight === run) heartbeatInFlight = null;
    }
  },

  pollNotifications: async () => {
    if (pollInFlight) return pollInFlight;
    if (useAuthStore.getState().status !== "ready") return;

    const run = (async () => {
      let headers = await useAuthStore.getState().resolveHeaders(true);
      if (!headers) return;

      let result = await pollLauncherNotifications(getSessionAuthApiUrl(), headers);

      if (result.unauthorized) {
        headers = await useAuthStore.getState().resolveHeaders(true);
        if (headers) {
          result = await pollLauncherNotifications(getSessionAuthApiUrl(), headers);
        }
      }

      if (result.unauthorized || result.error) return;

      const items = result.notifications.filter((item) => !seenNotificationIds.has(item.id));
      if (!items.length) return;

      const sessionHeaders = headers;
      if (!sessionHeaders) return;

      for (const item of items) {
        seenNotificationIds.add(item.id);
        launcherActions.pushNotification(item);
      }

      if (seenNotificationIds.size > MAX_SEEN_NOTIFICATIONS) {
        const keep = [...seenNotificationIds].slice(-MAX_SEEN_NOTIFICATIONS);
        seenNotificationIds.clear();
        for (const id of keep) seenNotificationIds.add(id);
      }

      await ackLauncherNotifications(
        getSessionAuthApiUrl(),
        sessionHeaders,
        items.map((i) => i.id)
      );
    })();

    pollInFlight = run;
    try {
      await run;
    } finally {
      if (pollInFlight === run) pollInFlight = null;
    }
  },

  applyWindowFromLayout: async () => {
    await applyElectronWindowFromLayout(getState().layout);
  },

  syncLayout: async () => {
    if (layoutSyncInFlight) return layoutSyncInFlight;

    const run = (async () => {
      const hadSync = Boolean(getState().lastSync);
      const cached = await readHubLayoutCacheRecord();
      setState({ loading: !hadSync && !cached, syncError: null });

      if (!hadSync && cached) {
        await useOfflineLayout(cached, null);
      }

      try {
        let headers = await useAuthStore.getState().resolveHeaders(true);
        if (!headers) {
          if (cached) {
            await useOfflineLayout(cached, "Sin sesión — usando configuración guardada");
            return;
          }
          throw new Error("Sin sesión activa");
        }

        let layout: HubLayout | null = null;
        try {
          layout = await fetchHubLayout(getAdminApiUrl(), headers);
        } catch (err) {
          if (!(err instanceof LauncherAuthError)) throw err;
          headers = await useAuthStore.getState().resolveHeaders(true);
          if (headers) {
            layout = await fetchHubLayout(getAdminApiUrl(), headers);
          }
        }

        if (!layout) {
          if (cached) {
            await useOfflineLayout(cached);
            return;
          }
          throw new Error("No se pudo obtener el layout del admin");
        }

        const remoteFp = hubLayoutFingerprint(layout);
        const currentFp = hubLayoutFingerprint(getState().layout);

        if (remoteFp === cached?.fingerprint && remoteFp === currentFp) {
          await applyElectronWindowFromLayout(getState().layout);
          setState({
            loading: false,
            lastSync: new Date().toISOString(),
            syncError: null,
          });
          void launcherActions.pollNotifications();
          return;
        }

        await applyHubLayoutToLauncher(layout, {
          lastSync: new Date().toISOString(),
          syncError: null,
          preserveActiveScreen: hadSync,
        });
        void launcherActions.pollNotifications();
      } catch (err) {
        if (cached) {
          await useOfflineLayout(cached, OFFLINE_LAYOUT_MSG, { preserveActiveScreen: hadSync });
          return;
        }
        if (err instanceof LauncherAuthError) {
          const headers = await useAuthStore.getState().resolveHeaders(true);
          if (headers) {
            const { verifyLauncherSession } = await import("@craftlauncher/shared");
            const check = await verifyLauncherSession(getSessionAuthApiUrl(), headers);
            if (!check.valid && check.reason !== "network" && check.reason !== "rate") {
              useAuthStore.getState().invalidateSession(
                "Sesión expirada o revocada. Activa de nuevo con un token nuevo."
              );
            } else if (getState().lastSync) {
              setState({ loading: false, syncError: null });
              return;
            }
          }
        }
        setState({
          loading: false,
          syncError: err instanceof Error ? err.message : "Error de sincronización",
        });
      }
    })();

    layoutSyncInFlight = run;
    try {
      await run;
    } finally {
      if (layoutSyncInFlight === run) layoutSyncInFlight = null;
    }
  },

  applyRemoteCommand: (cmd: RemoteCommand) => {
    if (cmd.type === "notification") {
      launcherActions.pushNotification({
        id: cmd.id ?? `ws-${Date.now()}`,
        title: cmd.title,
        message: cmd.message,
        style: cmd.style ?? "info",
        display: cmd.display ?? "toast",
        createdAt: new Date().toISOString(),
      });
      return;
    }
    if (cmd.type === "sync_hub_layout" && isHubLayout(cmd.layout)) {
      void applyHubLayoutToLauncher(cmd.layout, { preserveActiveScreen: true });
      launcherActions.pushFloatingAlert({
        id: `sync-${Date.now()}`,
        title: "Hub",
        message: "Layout actualizado desde el admin",
        style: "success",
      });
      return;
    }
    if (cmd.type === "kill_game") {
      void getLauncherApi()?.killMinecraft?.().then((res) => {
        launcherActions.pushFloatingAlert({
          id: `kill-${Date.now()}`,
          title: "Live Ops",
          message: res?.ok ? "Minecraft cerrado remotamente" : (res?.error ?? "No se pudo cerrar MC"),
          style: res?.ok ? "warning" : "error",
        });
      });
      return;
    }
    if (cmd.type === "restart") {
      launcherActions.pushFloatingAlert({
        id: `restart-${Date.now()}`,
        title: "Live Ops",
        message: "Reiniciando launcher…",
        style: "warning",
      });
      setTimeout(() => void getLauncherApi()?.restartLauncher?.(), 800);
    }
  },

  navigateToHubScreen: (screenId: string, options?: { recordHistory?: boolean }) => {
    const layout = getState().layout;
    if (!layout.screens.some((s) => s.id === screenId)) return;

    const screen = findHubScreen(layout, screenId);
    const desktop = isDesktopLauncher();

    if (desktop && screen && screenUsesDesktopWindow(screen)) {
      void openHubScreenWindow(screenId);
      return;
    }

    if (desktop && isHubScreenWindow()) {
      void navigateMainHubScreen(screenId);
      return;
    }

    launcherActions.setActiveScreen(screenId, options);
  },

  setActiveScreen: (screenId: string, options?: { recordHistory?: boolean }) => {
    if (!getState().layout.screens.some((s) => s.id === screenId)) return;
    const current = getState().layout.activeScreenId;
    if (options?.recordHistory !== false && current && current !== screenId) {
      pushScreenNavHistory(current);
    }
    setState((s) => ({ layout: { ...s.layout, activeScreenId: screenId } }));
    if (getState().layout.ui?.rememberLastScreen && typeof window !== "undefined") {
      try {
        localStorage.setItem(LAST_SCREEN_STORAGE_KEY, screenId);
      } catch {
        /* ignore */
      }
    }
    if (screenId === "screen-settings") {
      void useLauncherDataStore.getState().bootstrap();
    }
    clearPreviewIntervals();
    launcherActions.runScreenSetup();
  },

  goBackScreen: () => {
    const layout = getState().layout;
    const current = layout.activeScreenId;
    let target = popScreenNavHistory();
    while (target && !layout.screens.some((s) => s.id === target)) {
      target = popScreenNavHistory();
    }
    if (!target) {
      const fallback =
        layout.screens.find((s) => s.id === "screen-home") ?? layout.screens[0];
      if (!fallback || fallback.id === current) {
        launcherActions.pushFloatingAlert({
          id: `back-${Date.now()}`,
          title: "Navegación",
          message: "No hay una ventana anterior",
          style: "info",
        });
        return;
      }
      target = fallback.id;
    }
    launcherActions.setActiveScreen(target, { recordHistory: false });
  },

  updateElement: (id: string, patch: Partial<HubElement>) => {
    setState((s) => {
      const apply = (elements: HubElement[]) =>
        elements.map((el) =>
          el.id === id ? { ...el, ...patch, style: { ...el.style, ...patch.style } } : el
        );
      let patchedChrome = false;
      const screens = s.layout.screens.map((sc) => {
        if (!sc.chrome?.elements.some((e) => e.id === id)) return sc;
        patchedChrome = true;
        return {
          ...sc,
          chrome: { ...sc.chrome!, elements: apply(sc.chrome!.elements) },
        };
      });
      if (patchedChrome) {
        return { layout: { ...s.layout, screens } };
      }
      const legacyChrome = s.layout.launcherChrome;
      if (legacyChrome?.elements.some((e) => e.id === id)) {
        return {
          layout: {
            ...s.layout,
            launcherChrome: { ...legacyChrome, elements: apply(legacyChrome.elements) },
          },
        };
      }
      return {
        layout: {
          ...s.layout,
          screens: s.layout.screens.map((sc) => ({
            ...sc,
            elements: apply(sc.elements),
          })),
        },
      };
    });
  },

  runElementLogic: async (id: string) => {
    await runAtDepth(id, 0);
  },

  executeElementAction: async (elementId: string) => {
    const layout = getState().layout;
    const active = getActiveScreen(layout);
    const el =
      active.elements.find((e) => e.id === elementId) ??
      ensureScreenChrome(active, layout).elements.find((e) => e.id === elementId) ??
      findElementInLayout(layout, elementId);
    if (!el) return;

    if (hasVisibilityActions(el)) {
      applyShowHideFromConstants(el);
    }

    if (el.action === "sync-layout") {
      void launcherActions.syncLayout();
      return;
    }
    if (el.action === "minimize-window") {
      void getLauncherApi()?.minimize();
      return;
    }
    if (el.action === "close-window") {
      void getLauncherApi()?.close();
      return;
    }
    if (el.action === "open-launch-log") {
      launcherActions.showLaunchPanel();
      return;
    }
    if (el.action === "hide-launch-panel") {
      launcherActions.hideLaunchPanel();
      return;
    }

    if (el.type === "toggle-visible") {
      const visTarget = parseVisibilityActions(el.logic?.constants)[0]?.target ?? "";
      const target = String(
        visTarget ||
          el.logic?.constants?.TARGET ||
          el.logic?.constants?.TOGGLE ||
          el.logic?.refId ||
          ""
      ).trim();
      if (target) {
        const layout = getState().layout;
        const screen = getActiveScreen(layout);
        const t =
          findElementByRef(screen, target) ??
          layout.screens.flatMap((s) => s.elements).find((e) => e.logic?.refId === target) ??
          null;
        if (t) launcherActions.updateElement(t.id, { visible: !t.visible });
      }
    }

    if (el.logic?.enabled && el.logic.script.trim() && el.logic.trigger === "click") {
      await launcherActions.runElementLogic(elementId);
    }

    void dispatchAnyClickAutomation(elementId);

    if (el.action === "external" && el.externalUrl) {
      await openExternalUrl(el.externalUrl);
      return;
    }

    if (el.action === "play" || el.type === "play-show-bind") {
      const versionId = pickForgeVersionFromLayout(getState().layout, String(el.value ?? ""));
      await launcherActions.launchMinecraftForge(versionId);
      return;
    }

    if (el.action === "profile") {
      const layout = getState().layout;
      const target = resolveActionTargetScreen("profile", layout, el.targetScreenId);
      const screen = target ? layout.screens.find((s) => s.id === target) : null;
      const api = getLauncherApi();
      if (target && screenUsesDesktopWindow(screen)) {
        void openHubScreenWindow(target);
        return;
      }
      if (target) {
        launcherActions.navigateToHubScreen(target);
        return;
      }
      if (api?.openAccountWindow) {
        void api.openAccountWindow();
      }
      return;
    }

    if (el.action === "logout") {
      useAuthStore.getState().logout();
      return;
    }

    if (el.action === "settings") {
      const target = resolveActionTargetScreen("settings", getState().layout, el.targetScreenId);
      if (target) {
        launcherActions.navigateToHubScreen(target);
      } else {
        launcherActions.pushFloatingAlert({
          id: `settings-${Date.now()}`,
          title: "Ajustes",
          message: "ventana no configurada",
          style: "info",
        });
      }
      return;
    }
    if (el.action === "mods") {
      // Preferir ventana Hub (screen-mods) si existe; fallback a modal.
      const hasModsScreen = getState().layout.screens.some((s) => s.id === "screen-mods");
      if (hasModsScreen) {
        launcherActions.navigateToHubScreen("screen-mods");
      } else {
        useLauncherDataStore.getState().openPanel("mods");
      }
      return;
    }
    if (el.action === "skin") {
      useLauncherDataStore.getState().openPanel("skin");
      return;
    }
    if (el.action === "instances") {
      useLauncherDataStore.getState().openPanel("instances");
      return;
    }

    if (el.action === "back") {
      launcherActions.goBackScreen();
      return;
    }

    if (el.action === "create-instance") {
      void useLauncherDataStore.getState().submitInstanceDraft();
      return;
    }

    if (el.action === "select-instance" && el.value) {
      void useLauncherDataStore.getState().selectInstance(String(el.value));
      return;
    }

    if (el.action === "delete-instance" && el.value) {
      void useLauncherDataStore.getState().deleteInstance(String(el.value));
      return;
    }

    const target = resolveActionTargetScreen(el.action, getState().layout, el.targetScreenId);
    if (target) {
      launcherActions.navigateToHubScreen(target);
      return;
    }

    if (el.action !== "none") {
      launcherActions.pushFloatingAlert({
        id: `fallback-${Date.now()}`,
        title: actionFallbackLabel(el.action),
        message: "ventana no configurada",
        style: "info",
      });
    }
  },

  handleRuntimeChange: async (elementId: string, value: string | number | boolean) => {
    launcherActions.updateElement(elementId, { value });
    const el = findElementInLayout(getState().layout, elementId);
    if (!el) return;

    if (el.type === "panel-visibility-select") {
      await launcherActions.applyPanelVisibilitySelect(elementId, String(value), {
        hideOthers: Boolean(el.logic?.constants?.HIDE_OTHERS),
      });
      return;
    }

    if (isSelectorElementType(el.type)) {
      void dispatchSelectorChangeAutomation(el, value);
    }
    const screenEl = getActiveScreen(getState().layout).elements.find((e) => e.id === elementId);
    if (screenEl?.type === "instance-name-input") {
      useLauncherDataStore.getState().setInstanceDraftName(String(value));
    }
    if (el?.type === "instance-version-select") {
      useLauncherDataStore.getState().setInstanceDraftVersion(String(value));
    }
    if (el?.type === "instance-selector") {
      void useLauncherDataStore.getState().selectInstance(String(value));
    }
    if (el?.type === "installed-version-selector") {
      void useLauncherDataStore.getState().refreshInstalledVersions();
    }
    if (el?.logic?.enabled && el.logic.script.trim() && el.logic.trigger === "change") {
      await launcherActions.runElementLogic(elementId);
    }
  },

  runScreenSetup: () => {
    setHubScriptAutomationContext({ launchPhase: getState().launchSession.phase });
    if (getState().launchSession.phase === "idle" || getState().launchSession.phase === "closed") {
      hideLaunchHudOnIdle();
    }
    reconcileLaunchVisibilityRules();
    const layout = getState().layout;
    for (const screen of layout.screens) {
      for (const el of screen.elements) {
        if (!el.logic?.enabled) continue;
        if (!el.logic.script.trim() && !isVisibilityRuleElement(el)) continue;
        if (el.logic.trigger === "load") void launcherActions.runElementLogic(el.id);
        if (el.logic.trigger === "interval" && el.logic.intervalMs) {
          registerPreviewInterval(
            `${screen.id}:${el.id}`,
            setInterval(
              () => void launcherActions.runElementLogic(el.id),
              Math.max(500, el.logic.intervalMs)
            )
          );
        }
      }
    }
  },
};

bindMinecraftProgressFlush((payload) => {
  launcherActions.applyMinecraftProgress(payload);
});

function syncLaunchSessionToProgressWindow(session: LaunchSession) {
  if (!isDesktopLauncher()) return;
  if (!resolveLaunchDesktopWindow(getState().layout)) return;
  const api = getLauncherApi();
  void api?.syncLaunchSession?.(JSON.parse(JSON.stringify(session)));
}

function openLaunchProgressWindowIfNeeded(session: LaunchSession) {
  if (!isDesktopLauncher()) return;
  if (!resolveLaunchDesktopWindow(getState().layout)) return;
  if (!session.visible && session.phase !== "error" && session.phase !== "running") return;
  void getLauncherApi()?.openLaunchProgress?.();
}

launcherStore.subscribe((state, prev) => {
  if (state.launchSession === prev.launchSession) return;
  syncLaunchSessionToProgressWindow(state.launchSession);
  const p = prev.launchSession.phase;
  const n = state.launchSession.phase;
  if (p !== n) void dispatchLaunchPhaseAutomation(p, n);
  if (n === "idle" || n === "closed") hideLaunchHudOnIdle();
});

setHubScriptAutomationContext({ launchPhase: "idle" });
