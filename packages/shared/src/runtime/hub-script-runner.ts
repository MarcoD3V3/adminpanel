import type { HubElement } from "../types/hub-layout";
import { hubGroupFromToken, isHubGroupToken } from "../layout/hub-element-targets";
import { compileFriendlyScript } from "./hub-script-sugar";
import { compileSimpleScript, isSimpleScriptMode } from "./hub-script-simple";

export interface ScriptRunResult {
  success: boolean;
  message: string;
  logs: string[];
}

export interface ScriptRuntimeCallbacks {
  updateElement: (id: string, patch: Partial<HubElement>) => void;
  getElementById: (id: string) => HubElement | null;
  getElementByRef: (refId: string) => HubElement | null;
  getAllElements: () => HubElement[];
  getActiveScreenId: () => string;
  setActiveScreen: (screenId: string) => void;
  goBackScreen?: () => void;
  runLogicByRef: (refId: string, depth: number) => Promise<ScriptRunResult | null>;
  runLogicById: (id: string, depth: number) => Promise<ScriptRunResult | null>;
  onEmit?: (event: string, data?: unknown) => void;
}

type StateBag = Record<string, Record<string, unknown>>;
const elementState: StateBag = {};
const globalState: Record<string, unknown> = {};

export function resetHubScriptRuntime() {
  for (const key of Object.keys(elementState)) delete elementState[key];
  for (const key of Object.keys(globalState)) delete globalState[key];
}

/** Contexto de automatización (fase MC, último clic) para scripts con disparadores de evento. */
export function setHubScriptAutomationContext(ctx: {
  launchPhase?: string;
  clickedElementId?: string | null;
  selectorElementId?: string | null;
  selectorRef?: string | null;
  selectorValue?: unknown;
}) {
  if (ctx.launchPhase !== undefined) globalState.__launchPhase = ctx.launchPhase;
  if (ctx.clickedElementId !== undefined) {
    if (ctx.clickedElementId) globalState.__clickedElementId = ctx.clickedElementId;
    else delete globalState.__clickedElementId;
  }
  if (ctx.selectorElementId !== undefined) {
    if (ctx.selectorElementId) globalState.__selectorElementId = ctx.selectorElementId;
    else delete globalState.__selectorElementId;
  }
  if (ctx.selectorRef !== undefined) {
    if (ctx.selectorRef) globalState.__selectorRef = ctx.selectorRef;
    else delete globalState.__selectorRef;
  }
  if (ctx.selectorValue !== undefined) {
    globalState.__selectorValue = ctx.selectorValue;
  }
}

function toNum(value: unknown, fallback = 0): number {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function resolveRefElement(refOrId: string, callbacks: ScriptRuntimeCallbacks): HubElement | null {
  return callbacks.getElementByRef(refOrId) ?? callbacks.getElementById(refOrId);
}

function createHubScriptContext(
  element: HubElement,
  callbacks: ScriptRuntimeCallbacks,
  logs: string[]
) {
  const state = elementState[element.id] ?? (elementState[element.id] = {});
  const constants = element.logic?.constants ?? {};

  const patchByRef = (refId: string, patch: Partial<HubElement>) => {
    const token = refId.trim();
    if (!token) return;
    if (isHubGroupToken(token)) {
      const group = hubGroupFromToken(token);
      for (const el of callbacks.getAllElements()) {
        const g = (el.hubGroup ?? "").trim().replace(/\s+/g, "_");
        if (g && g === group.replace(/\s+/g, "_")) callbacks.updateElement(el.id, patch);
      }
      return;
    }
    const all = callbacks.getAllElements().filter((e) => e.logic?.refId?.trim() === token);
    if (all.length) {
      for (const el of all) callbacks.updateElement(el.id, patch);
      return;
    }
    const target = resolveRefElement(token, callbacks);
    if (target) callbacks.updateElement(target.id, patch);
  };

  return {
    ref: element.logic?.refId?.trim() || element.id,
    element,
    k: (key: string, fallback?: unknown) => (key in constants ? constants[key] : fallback),
    toNumber: toNum,
    get: (refId: string) => resolveRefElement(refId, callbacks),
    exists: (refId: string) => resolveRefElement(refId, callbacks) !== null,
    setValue: (refId: string, value: string | number | boolean) => patchByRef(refId, { value }),
    setLabel: (refId: string, label: string) => patchByRef(refId, { label }),
    show: (refId: string) => patchByRef(refId, { visible: true }),
    hide: (refId: string) => patchByRef(refId, { visible: false }),
    toggleVisible: (refId: string) => {
      const target = resolveRefElement(refId, callbacks);
      if (target) patchByRef(refId, { visible: !target.visible });
    },
    run: (refId: string) => callbacks.runLogicByRef(refId, 1),
    inc: (key: string, by = 1) => {
      const next = toNum(state[key], 0) + by;
      state[key] = next;
      return next;
    },
    setGlobal: (key: string, value: unknown) => {
      globalState[key] = value;
      if (key === "modsTab") callbacks.onEmit?.("mods-catalog", { tab: value });
      if (key === "modsQuery") callbacks.onEmit?.("mods-catalog", { query: value });
    },
    g: (key: string) => globalState[key],
    num: (refId: string, fallback = 0) => toNum(resolveRefElement(refId, callbacks)?.value, fallback),
    val: (refId: string, fallback?: unknown) => resolveRefElement(refId, callbacks)?.value ?? fallback,
    setScreen: (screenId: string) => callbacks.setActiveScreen(screenId),
    goBack: () => {
      if (callbacks.goBackScreen) callbacks.goBackScreen();
      else callbacks.onEmit?.("navigate", { back: true });
    },
    wait: (ms: number) => new Promise((r) => setTimeout(r, ms)),
    random: (min = 0, max = 1) => Math.floor(Math.random() * (max - min + 1)) + min,
    log: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
    toast: (message: string, type = "info") => callbacks.onEmit?.("toast", { message, type }),
    assert: (condition: unknown, message = "Assertion failed") => {
      if (!condition) throw new Error(message);
    },
    updateElement: (patch: Partial<HubElement>) => callbacks.updateElement(element.id, patch),
    emit: (event: string, data?: unknown) => callbacks.onEmit?.(event, data),
    launchPhase: () => String(globalState.__launchPhase ?? "idle"),
    isLaunchRunning: () => globalState.__launchPhase === "running",
    isLaunchActive: () =>
      ["checking", "preparing", "downloading", "starting"].includes(
        String(globalState.__launchPhase ?? "")
      ),
    isLaunchIdle: () => {
      const p = String(globalState.__launchPhase ?? "idle");
      return p === "idle" || p === "closed";
    },
    clickedElement: () => {
      const id = String(globalState.__clickedElementId ?? "").trim();
      if (!id) return null;
      return callbacks.getElementById(id) ?? callbacks.getAllElements().find((e) => e.id === id) ?? null;
    },
    selectorValue: () => globalState.__selectorValue,
    selectorRef: () => String(globalState.__selectorRef ?? "").trim() || null,
    selectorElement: () => {
      const id = String(globalState.__selectorElementId ?? "").trim();
      if (!id) return null;
      return callbacks.getElementById(id) ?? null;
    },
    createInstance: (name?: string, mcVersion?: string) => {
      if (name !== undefined) globalState.pendingInstanceName = name;
      if (mcVersion !== undefined) globalState.pendingInstanceVersion = mcVersion;
      callbacks.onEmit?.("instance", {
        action: "create",
        name: name ?? String(globalState.pendingInstanceName ?? ""),
        mcVersion: mcVersion ?? String(globalState.pendingInstanceVersion ?? "1.20.1"),
      });
    },
    selectInstance: (id: string) => {
      callbacks.onEmit?.("instance", { action: "select", id: String(id) });
    },
    deleteInstance: (id: string) => {
      callbacks.onEmit?.("instance", { action: "delete", id: String(id) });
    },
    setInstanceDraft: (name: string, mcVersion?: string) => {
      globalState.pendingInstanceName = name;
      if (mcVersion) globalState.pendingInstanceVersion = mcVersion;
    },
    api: async (url: string, options: { method?: string; body?: unknown } = {}) => {
      const res = await fetch(url, {
        method: options.method ?? "GET",
        headers: { "Content-Type": "application/json" },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      let data: unknown = null;
      try {
        data = await res.json();
      } catch {
        data = await res.text();
      }
      return { status: res.status, data };
    },
  };
}

const MAX_RUN_DEPTH = 10;

export async function runHubScript(
  element: HubElement,
  script: string,
  callbacks: ScriptRuntimeCallbacks,
  depth = 0
): Promise<ScriptRunResult> {
  const logs: string[] = [];
  if (depth > MAX_RUN_DEPTH) {
    return { success: false, message: "Límite de ejecuciones anidadas", logs };
  }

  const ctx = createHubScriptContext(element, callbacks, logs);
  try {
    const compiled = isSimpleScriptMode(element.logic?.scriptMode)
      ? compileSimpleScript(script)
      : compileFriendlyScript(script);
    const fn = new Function("ctx", `"use strict";\nreturn (async () => {\n${compiled}\n})();`);
    await fn(ctx);
    return { success: true, message: logs.at(-1) ?? "OK", logs };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : String(err), logs };
  }
}
