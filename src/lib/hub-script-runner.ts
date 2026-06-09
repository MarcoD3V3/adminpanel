import type { HubElement, LogicTrigger } from "@/types/hub-builder";
import { hubGroupFromToken, isHubGroupToken } from "@craftlauncher/shared";
import { compileFriendlyScript } from "@/lib/hub-script-sugar";
import { compileSimpleScript, isSimpleScriptMode } from "@/lib/hub-script-simple";

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

export interface ScriptContextAPI {
  /** ID lógico del elemento (refId o id interno) */
  ref: string;
  id: string;
  element: HubElement;

  const: (key: string, fallback?: unknown) => unknown;
  getConst: (key: string, fallback?: unknown) => unknown;
  consts: () => Record<string, string | number | boolean>;

  getState: (key: string) => unknown;
  setState: (key: string, value: unknown) => void;
  hasState: (key: string) => boolean;
  delState: (key: string) => void;
  inc: (key: string, by?: number) => number;
  dec: (key: string, by?: number) => number;

  getGlobal: (key: string) => unknown;
  setGlobal: (key: string, value: unknown) => void;
  hasGlobal: (key: string) => boolean;
  delGlobal: (key: string) => void;

  get: (refId: string) => HubElement | null;
  exists: (refId: string) => boolean;
  getValue: (refId: string) => unknown;
  setValue: (refId: string, value: string | number | boolean) => void;
  setLabel: (refId: string, label: string) => void;
  show: (refId: string) => void;
  hide: (refId: string) => void;
  toggleVisible: (refId: string) => void;
  run: (refId: string) => Promise<ScriptRunResult | null>;

  eq: (a: unknown, b: unknown) => boolean;
  ne: (a: unknown, b: unknown) => boolean;
  gt: (a: number, b: number) => boolean;
  gte: (a: number, b: number) => boolean;
  lt: (a: number, b: number) => boolean;
  lte: (a: number, b: number) => boolean;
  between: (n: number, min: number, max: number) => boolean;
  and: (...values: unknown[]) => boolean;
  or: (...values: unknown[]) => boolean;
  not: (value: unknown) => boolean;

  assert: (condition: unknown, message?: string) => void;
  check: (condition: unknown, message?: string) => boolean;
  verify: (condition: unknown, okMessage?: string, failMessage?: string) => boolean;
  when: (condition: unknown, onTrue: () => void | Promise<void>, onFalse?: () => void | Promise<void>) => Promise<void>;

  isEmpty: (value: unknown) => boolean;
  isNumber: (value: unknown) => value is number;
  isString: (value: unknown) => value is string;
  isBool: (value: unknown) => value is boolean;
  toNumber: (value: unknown, fallback?: number) => number;
  toString: (value: unknown, fallback?: string) => string;

  random: (min?: number, max?: number) => number;
  randomPick: <T>(items: T[]) => T | undefined;
  clamp: (n: number, min: number, max: number) => number;
  min: (...values: number[]) => number;
  max: (...values: number[]) => number;
  now: () => number;
  today: () => string;
  wait: (ms: number) => Promise<void>;

  screen: () => string;
  setScreen: (screenId: string) => void;
  goBack: () => void;
  elementCount: () => number;

  updateElement: (patch: Partial<HubElement>) => void;
  log: (...args: unknown[]) => void;
  emit: (event: string, data?: unknown) => void;
  api: (url: string, options?: { method?: string; body?: unknown }) => Promise<{ status: number; data: unknown }>;
  navigate: (action: string) => void;

  /** Atajos amigables */
  k: (key: string, fallback?: unknown) => unknown;
  num: (refId: string, fallback?: number) => number;
  val: (refId: string, fallback?: unknown) => unknown;
  g: (key: string) => unknown;
  toast: (message: string, type?: string) => void;
  on: (
    condition: unknown,
    onTrue: () => void | Promise<void>,
    onFalse?: () => void | Promise<void>
  ) => Promise<void>;
}

type StateBag = Record<string, Record<string, unknown>>;
const elementState: StateBag = {};
const globalState: Record<string, unknown> = {};

export function getElementState(elementId: string): Record<string, unknown> {
  if (!elementState[elementId]) elementState[elementId] = {};
  return elementState[elementId];
}

export function resetHubScriptRuntime() {
  for (const key of Object.keys(elementState)) delete elementState[key];
  for (const key of Object.keys(globalState)) delete globalState[key];
}

function toNum(value: unknown, fallback = 0): number {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function resolveRefElement(
  refOrId: string,
  callbacks: ScriptRuntimeCallbacks
): HubElement | null {
  return callbacks.getElementByRef(refOrId) ?? callbacks.getElementById(refOrId);
}

export function createHubScriptContext(
  element: HubElement,
  callbacks: ScriptRuntimeCallbacks,
  logs: string[]
): ScriptContextAPI {
  const state = getElementState(element.id);
  const ref = element.logic?.refId?.trim() || element.id;
  const constants = element.logic?.constants ?? {};

  const log = (...args: unknown[]) => {
    const line = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
    logs.push(line);
  };

  const patchByRef = (refId: string, patch: Partial<HubElement>) => {
    const token = refId.trim();
    if (!token) return;
    if (isHubGroupToken(token)) {
      const group = hubGroupFromToken(token).replace(/\s+/g, "_");
      const hits = callbacks.getAllElements().filter((e) => (e.hubGroup ?? "").trim().replace(/\s+/g, "_") === group);
      if (!hits.length) {
        log(`[warn] No hay elementos en grupo: ${group}`);
        return;
      }
      for (const el of hits) callbacks.updateElement(el.id, patch);
      return;
    }
    const byRef = callbacks.getAllElements().filter((e) => e.logic?.refId?.trim() === token);
    if (byRef.length) {
      for (const el of byRef) callbacks.updateElement(el.id, patch);
      return;
    }
    const target = resolveRefElement(token, callbacks);
    if (!target) {
      log(`[warn] No existe ref: ${token}`);
      return;
    }
    callbacks.updateElement(target.id, patch);
  };

  return {
    ref,
    id: ref,
    element,

    const: (key, fallback) => (key in constants ? constants[key] : fallback),
    getConst: (key, fallback) => (key in constants ? constants[key] : fallback),
    consts: () => ({ ...constants }),

    getState: (key) => state[key],
    setState: (key, value) => {
      state[key] = value;
    },
    hasState: (key) => key in state,
    delState: (key) => {
      delete state[key];
    },
    inc: (key, by = 1) => {
      const next = toNum(state[key], 0) + by;
      state[key] = next;
      return next;
    },
    dec: (key, by = 1) => {
      const next = toNum(state[key], 0) - by;
      state[key] = next;
      return next;
    },

    getGlobal: (key) => globalState[key],
    setGlobal: (key, value) => {
      globalState[key] = value;
    },
    hasGlobal: (key) => key in globalState,
    delGlobal: (key) => {
      delete globalState[key];
    },

    get: (refId) => resolveRefElement(refId, callbacks),
    exists: (refId) => resolveRefElement(refId, callbacks) !== null,
    getValue: (refId) => resolveRefElement(refId, callbacks)?.value,
    setValue: (refId, value) => patchByRef(refId, { value }),
    setLabel: (refId, label) => patchByRef(refId, { label }),
    show: (refId) => patchByRef(refId, { visible: true }),
    hide: (refId) => patchByRef(refId, { visible: false }),
    toggleVisible: (refId) => {
      const target = resolveRefElement(refId, callbacks);
      if (target) patchByRef(refId, { visible: !target.visible });
    },
    run: (refId) => callbacks.runLogicByRef(refId, 1),

    eq: (a, b) => a === b,
    ne: (a, b) => a !== b,
    gt: (a, b) => a > b,
    gte: (a, b) => a >= b,
    lt: (a, b) => a < b,
    lte: (a, b) => a <= b,
    between: (n, min, max) => n >= min && n <= max,
    and: (...values) => values.every(Boolean),
    or: (...values) => values.some(Boolean),
    not: (value) => !value,

    assert: (condition, message = "Assertion failed") => {
      if (!condition) throw new Error(message);
    },
    check: (condition, message = "Check failed") => {
      if (!condition) log(`[check] ${message}`);
      return Boolean(condition);
    },
    verify: (condition, okMessage = "OK", failMessage = "Falló verificación") => {
      if (condition) {
        log(`[verify] ${okMessage}`);
        return true;
      }
      log(`[verify] ${failMessage}`);
      return false;
    },
    when: async (condition, onTrue, onFalse) => {
      if (condition) await onTrue();
      else if (onFalse) await onFalse();
    },

    isEmpty: (value) =>
      value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0),
    isNumber: (value): value is number => typeof value === "number" && !Number.isNaN(value),
    isString: (value): value is string => typeof value === "string",
    isBool: (value): value is boolean => typeof value === "boolean",
    toNumber: toNum,
    toString: (value, fallback = "") => (value == null ? fallback : String(value)),

    random: (min = 0, max = 1) => Math.floor(Math.random() * (max - min + 1)) + min,
    randomPick: (items) => (items.length ? items[Math.floor(Math.random() * items.length)] : undefined),
    clamp: (n, min, max) => Math.min(max, Math.max(min, n)),
    min: (...values) => Math.min(...values),
    max: (...values) => Math.max(...values),
    now: () => Date.now(),
    today: () => new Date().toISOString().slice(0, 10),
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),

    screen: () => callbacks.getActiveScreenId(),
    setScreen: (screenId) => callbacks.setActiveScreen(screenId),
    goBack: () => {
      if (callbacks.goBackScreen) callbacks.goBackScreen();
      else callbacks.onEmit?.("navigate", { back: true });
    },
    elementCount: () => callbacks.getAllElements().length,

    updateElement: (patch) => callbacks.updateElement(element.id, patch),
    log,
    emit: (event, data) => callbacks.onEmit?.(event, data),
    api: async (url, options = {}) => {
      try {
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
      } catch (err) {
        return { status: 0, data: String(err) };
      }
    },
    navigate: (action) => callbacks.onEmit?.("navigate", { action }),

    k: (key, fallback) => (key in constants ? constants[key] : fallback),
    num: (refId, fallback = 0) => toNum(resolveRefElement(refId, callbacks)?.value, fallback),
    val: (refId, fallback) => resolveRefElement(refId, callbacks)?.value ?? fallback,
    g: (key) => globalState[key],
    toast: (message, type = "info") => callbacks.onEmit?.("toast", { message, type }),
    on: async (condition, onTrue, onFalse) => {
      if (condition) await onTrue();
      else if (onFalse) await onFalse();
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
    return { success: false, message: "Límite de ejecuciones anidadas alcanzado", logs };
  }

  const ctx = createHubScriptContext(element, callbacks, logs);

  try {
    const compiled = isSimpleScriptMode(element.logic?.scriptMode)
      ? compileSimpleScript(script)
      : compileFriendlyScript(script);
    const fn = new Function("ctx", `"use strict";\nreturn (async () => {\n${compiled}\n})();`);
    await fn(ctx);
    return {
      success: true,
      message: logs.length ? logs[logs.length - 1] : "Script ejecutado",
      logs,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: msg, logs };
  }
}

export function triggerLabel(trigger: LogicTrigger): string {
  const labels: Record<LogicTrigger, string> = {
    click: "Clic",
    change: "Cambio",
    load: "Al cargar",
    interval: "Intervalo",
    submit: "Enviar",
    "any-click": "Cualquier clic (pantalla)",
    "phase-change": "Cambio fase lanzamiento",
    "launch-idle": "MC parado / cerrado",
    "launch-active": "Descargando / preparando",
    "launch-running": "En juego",
    "launch-error": "Error al lanzar",
    "launch-ended": "Sesión de lanzamiento terminó",
    "selector-change": "Al cambiar selector (perfil/versión)",
  };
  return labels[trigger] ?? trigger;
}

export const SCRIPT_API_GROUPS: { title: string; items: string[] }[] = [
  {
    title: "Modo simple (español)",
    items: [
      "$ref / @CONST / ~global — leer valores",
      "avisa / mostrar / ocultar / alternar",
      "set / label / ejecutar / guardarGlobal",
      "esperar(ms) / aleatorio(min,max) / pantalla(id)",
      "if / else — condiciones normales",
    ],
  },
  {
    title: "Atajos ctx",
    items: [
      "ctx.k('MAX') / ctx.num('ref') / ctx.val('ref')",
      "avisa / mostrar / ocultar / ejecutar (español)",
      "set('ref', v) / label('ref', txt) / log(...)",
      "ctx.g('key') / ctx.setGlobal('key', v)",
      "ctx.toast('msg') / ctx.on(cond, fn)",
      "ctx.ref / ctx.element",
    ],
  },
  {
    title: "Estado",
    items: [
      "ctx.getState / setState / inc / dec",
      "ctx.getGlobal / setGlobal",
      "ctx.setValue('ref', n) / ctx.setLabel('ref', 'txt')",
    ],
  },
  {
    title: "Verificar",
    items: [
      "ctx.assert(cond, 'msg') — error si falla",
      "ctx.check / ctx.verify",
      "if / else — preferido en modo simple",
    ],
  },
  {
    title: "Otros",
    items: [
      "ctx.run('ref') / ctx.exists('ref')",
      "ctx.setScreen('screen-play') / ctx.goBack() / ctx.wait(ms)",
      "ctx.api(url) / ctx.log(...)",
    ],
  },
  {
    title: "Perfiles / instancias",
    items: [
      "ctx.createInstance(nombre, version)",
      "ctx.selectInstance('carpeta-id')",
      "ctx.deleteInstance('carpeta-id')",
      "ctx.setInstanceDraft(nombre, version)",
      "refs: instance.name, instance.version",
    ],
  },
];
