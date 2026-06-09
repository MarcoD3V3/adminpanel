import type { MinecraftProgressPayload } from "./electron-api";

const IMMEDIATE_STAGES = new Set(["error", "launched", "close", "starting"]);

let latestProgress: MinecraftProgressPayload | null = null;
let queued: MinecraftProgressPayload[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let flushFn: ((payload: MinecraftProgressPayload) => void) | null = null;

const FLUSH_MS = 300;

function shouldFlushImmediately(payload: MinecraftProgressPayload) {
  const stage = payload.stage ?? "";
  if (IMMEDIATE_STAGES.has(stage)) return true;
  if (stage === "java-ok" || stage === "checking" || stage === "start") return true;
  if (stage === "downloading" && payload.message && !/assets:/i.test(payload.message)) return true;
  return false;
}

function flushAll() {
  if (!flushFn) return;
  for (const item of queued) flushFn(item);
  queued = [];
  if (latestProgress) {
    flushFn(latestProgress);
    latestProgress = null;
  }
}

export function bindMinecraftProgressFlush(fn: (payload: MinecraftProgressPayload) => void) {
  flushFn = fn;
}

export function enqueueMinecraftProgress(payload: MinecraftProgressPayload) {
  if (!flushFn) return;

  if (shouldFlushImmediately(payload)) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    flushAll();
    flushFn(payload);
    return;
  }

  if (payload.stage === "progress") {
    latestProgress = payload;
  } else if (payload.stage === "install-log" || payload.stage === "log" || payload.stage === "debug") {
    queued.push(payload);
    if (queued.length > 6) queued.splice(0, queued.length - 6);
  } else {
    queued.push(payload);
    if (queued.length > 8) queued.splice(0, queued.length - 8);
  }

  if (!timer) {
    timer = setTimeout(() => {
      timer = null;
      flushAll();
    }, FLUSH_MS);
  }
}

export function resetMinecraftProgressThrottle() {
  if (timer) clearTimeout(timer);
  timer = null;
  latestProgress = null;
  queued = [];
}
