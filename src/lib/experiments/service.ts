import { createHash, randomBytes } from "node:crypto";
import type { Experiment } from "@/types/features";
import { mockExperiments } from "@/lib/feature-data";
import {
  emptyExperimentStats,
  mutateExperimentStore,
  type ExperimentRecord,
  type ExperimentStats,
  type VariantStats,
} from "./store";

const HEARTBEAT_MINUTES = 0.25;
const RETURN_AFTER_MS = 24 * 60 * 60 * 1000;
const MAX_TRACKED_DEVICES = 5000;

function hashPercent(seed: string): number {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 8);
  return (parseInt(hex, 16) % 10000) / 100;
}

export function assignExperimentVariant(
  experimentKey: string,
  deviceId: string,
  rolloutPercent: number
): "A" | "B" | null {
  const bucket = hashPercent(`${experimentKey}:${deviceId}`);
  if (bucket >= rolloutPercent) return null;
  return hashPercent(`${experimentKey}:${deviceId}:variant`) < 50 ? "A" : "B";
}

function ensureStats(stats: Record<string, ExperimentStats>, id: string): ExperimentStats {
  if (!stats[id]) stats[id] = emptyExperimentStats();
  return stats[id];
}

function trackUniqueDevice(variant: VariantStats, deviceId: string): void {
  if (variant.uniqueDevices.includes(deviceId)) return;
  variant.uniqueDevices.push(deviceId);
  if (variant.uniqueDevices.length > MAX_TRACKED_DEVICES) {
    variant.uniqueDevices = variant.uniqueDevices.slice(-MAX_TRACKED_DEVICES);
  }
}

function computeMetricValue(metric: Experiment["metric"], variant: VariantStats): number {
  const users = variant.uniqueDevices.length;
  if (users === 0) return 0;

  switch (metric) {
    case "session_time":
      return Math.round((variant.sessionMinutes / Math.max(variant.exposures, 1)) * 10) / 10;
    case "retention":
      return Math.round((variant.returns / users) * 1000) / 10;
    case "conversion":
      return Math.round((variant.launches / users) * 1000) / 10;
    case "crash_rate":
      return Math.round((variant.crashes / Math.max(variant.exposures, 1)) * 1000) / 10;
    default:
      return 0;
  }
}

function lowerIsBetter(metric: Experiment["metric"]): boolean {
  return metric === "crash_rate";
}

export function computeExperimentResults(exp: ExperimentRecord, stats: ExperimentStats): Experiment {
  const resultA = computeMetricValue(exp.metric, stats.A);
  const resultB = computeMetricValue(exp.metric, stats.B);
  let winner: Experiment["winner"] = exp.winner ?? null;

  if (exp.status === "completed" && winner) {
    return { ...exp, resultA, resultB, winner };
  }

  const minSamples = 5;
  if (stats.A.uniqueDevices.length >= minSamples && stats.B.uniqueDevices.length >= minSamples) {
    if (resultA !== resultB) {
      const aWins = lowerIsBetter(exp.metric) ? resultA < resultB : resultA > resultB;
      winner = aWins ? "A" : "B";
    }
  }

  return { ...exp, resultA, resultB, winner };
}

function seedDefaults(): ExperimentRecord[] {
  const now = new Date().toISOString();
  return mockExperiments.map((exp) => ({
    ...exp,
    resultA: 0,
    resultB: 0,
    winner: exp.status === "completed" ? exp.winner : undefined,
    createdAt: exp.startedAt ?? now,
    updatedAt: now,
  }));
}

export async function listExperiments(): Promise<Experiment[]> {
  const store = await mutateExperimentStore((s) => {
    if (!s.experiments.length) {
      s.experiments = seedDefaults();
      for (const exp of s.experiments) {
        s.stats[exp.id] = emptyExperimentStats();
      }
    }
    return s;
  });

  return store.experiments.map((exp) =>
    computeExperimentResults(exp, ensureStats(store.stats, exp.id))
  );
}

export async function createExperiment(input: {
  name: string;
  key: string;
  description: string;
  variantA: string;
  variantB: string;
  metric: Experiment["metric"];
  rolloutPercent: number;
}): Promise<Experiment> {
  const now = new Date().toISOString();
  const id = `ex_${randomBytes(6).toString("hex")}`;
  const record: ExperimentRecord = {
    id,
    name: input.name.trim(),
    key: input.key.trim(),
    description: input.description.trim(),
    status: "draft",
    variantA: input.variantA.trim() || "Control",
    variantB: input.variantB.trim() || "Variante B",
    rolloutPercent: Math.min(100, Math.max(1, input.rolloutPercent || 50)),
    metric: input.metric,
    resultA: 0,
    resultB: 0,
    createdAt: now,
    updatedAt: now,
  };

  const store = await mutateExperimentStore((s) => {
    if (s.experiments.some((e) => e.key === record.key)) {
      throw new Error("Ya existe un experimento con esa feature key");
    }
    s.experiments.unshift(record);
    s.stats[record.id] = emptyExperimentStats();
    return s;
  });

  return computeExperimentResults(record, ensureStats(store.stats, record.id));
}

export async function updateExperimentStatus(
  id: string,
  status: Experiment["status"]
): Promise<Experiment | null> {
  const store = await mutateExperimentStore((s) => {
    const exp = s.experiments.find((e) => e.id === id);
    if (!exp) return s;

    exp.status = status;
    exp.updatedAt = new Date().toISOString();
    if (status === "running" && !exp.startedAt) {
      exp.startedAt = exp.updatedAt;
    }
    if (status === "completed") {
      const stats = ensureStats(s.stats, exp.id);
      const computed = computeExperimentResults(exp, stats);
      exp.winner = computed.winner ?? undefined;
      exp.resultA = computed.resultA;
      exp.resultB = computed.resultB;
    }
    return s;
  });

  const exp = store.experiments.find((e) => e.id === id);
  if (!exp) return null;
  const result = computeExperimentResults(exp, ensureStats(store.stats, exp.id));

  const { emitSystemEvent } = await import("@/lib/system-events");
  if (status === "running") {
    emitSystemEvent("experiment.started", {
      name: result.name,
      key: result.key,
      rollout: result.rolloutPercent,
    });
  }
  if (status === "completed") {
    emitSystemEvent("experiment.completed", {
      name: result.name,
      key: result.key,
      winner: result.winner,
      resultA: result.resultA,
      resultB: result.resultB,
      metric: result.metric,
    });
  }

  return result;
}

export type ActiveExperimentAssignment = {
  key: string;
  variant: "A" | "B";
  variantLabel: string;
};

export async function getActiveAssignments(deviceId: string): Promise<ActiveExperimentAssignment[]> {
  const experiments = await listExperiments();
  const assignments: ActiveExperimentAssignment[] = [];

  for (const exp of experiments) {
    if (exp.status !== "running") continue;
    const variant = assignExperimentVariant(exp.key, deviceId, exp.rolloutPercent);
    if (!variant) continue;
    assignments.push({
      key: exp.key,
      variant,
      variantLabel: variant === "A" ? exp.variantA : exp.variantB,
    });
  }

  return assignments;
}

export type ExperimentOverview = {
  running: number;
  completed: number;
  usersInTests: number;
  trafficPercent: number;
};

export async function getExperimentOverview(): Promise<ExperimentOverview> {
  const store = await loadStoreWithDefaults();
  const running = store.experiments.filter((e) => e.status === "running");
  const completed = store.experiments.filter((e) => e.status === "completed").length;

  const devices = new Set<string>();
  let maxRollout = 0;
  for (const exp of running) {
    maxRollout = Math.max(maxRollout, exp.rolloutPercent);
    const stats = ensureStats(store.stats, exp.id);
    for (const id of stats.A.uniqueDevices) devices.add(id);
    for (const id of stats.B.uniqueDevices) devices.add(id);
  }

  return {
    running: running.length,
    completed,
    usersInTests: devices.size,
    trafficPercent: running.length ? Math.round(maxRollout) : 0,
  };
}

async function loadStoreWithDefaults() {
  await listExperiments();
  const { loadExperimentStore } = await import("./store");
  return loadExperimentStore();
}

export type ExperimentHeartbeatInput = {
  deviceId: string;
  status: string;
  prevStatus?: string;
};

export async function recordExperimentHeartbeat(
  input: ExperimentHeartbeatInput
): Promise<Record<string, "A" | "B">> {
  const assignments: Record<string, "A" | "B"> = {};

  await mutateExperimentStore((s) => {
    const now = Date.now();
    const nowIso = new Date().toISOString();
    const prev = input.prevStatus ?? s.deviceStatus[input.deviceId];

    if (!s.deviceFirstSeen[input.deviceId]) {
      s.deviceFirstSeen[input.deviceId] = nowIso;
    }

    const countReturn =
      Boolean(s.deviceFirstSeen[input.deviceId]) &&
      !s.deviceReturnCounted[input.deviceId] &&
      now - Date.parse(s.deviceFirstSeen[input.deviceId]) >= RETURN_AFTER_MS;

    if (countReturn) {
      s.deviceReturnCounted[input.deviceId] = true;
    }

    s.deviceStatus[input.deviceId] = input.status;

    for (const exp of s.experiments) {
      if (exp.status !== "running") continue;

      const variant = assignExperimentVariant(exp.key, input.deviceId, exp.rolloutPercent);
      if (!variant) continue;

      assignments[exp.key] = variant;
      const stats = ensureStats(s.stats, exp.id);
      const bucket = stats[variant];

      bucket.exposures += 1;
      trackUniqueDevice(bucket, input.deviceId);

      if (input.status === "playing") {
        bucket.sessionMinutes += HEARTBEAT_MINUTES;
      }

      if (input.status === "launching" && prev !== "launching" && prev !== "playing") {
        bucket.launches += 1;
      }

      if (input.status === "error" || input.status === "crashed") {
        bucket.crashes += 1;
      }

      if (countReturn) {
        bucket.returns += 1;
      }
    }

    return s;
  });

  return assignments;
}
