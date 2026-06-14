import { existsSync, readFileSync } from "node:fs";
import type { Experiment } from "@/types/features";
import { dataPath } from "@/lib/data-dir";
import { getSqliteDb, hasSqliteExperiments } from "@/lib/db/sqlite";

export type ExperimentMetric = Experiment["metric"];

export type ExperimentRecord = Experiment & {
  createdAt: string;
  updatedAt: string;
};

export type VariantStats = {
  exposures: number;
  uniqueDevices: string[];
  sessionMinutes: number;
  launches: number;
  returns: number;
  crashes: number;
};

export type ExperimentStats = {
  A: VariantStats;
  B: VariantStats;
};

export type ExperimentStore = {
  experiments: ExperimentRecord[];
  stats: Record<string, ExperimentStats>;
  deviceStatus: Record<string, string>;
  deviceFirstSeen: Record<string, string>;
  deviceReturnCounted: Record<string, boolean>;
};

const LEGACY_FILE = dataPath("experiments.json");

const emptyVariantStats = (): VariantStats => ({
  exposures: 0,
  uniqueDevices: [],
  sessionMinutes: 0,
  launches: 0,
  returns: 0,
  crashes: 0,
});

export const emptyExperimentStats = (): ExperimentStats => ({
  A: emptyVariantStats(),
  B: emptyVariantStats(),
});

const EMPTY: ExperimentStore = {
  experiments: [],
  stats: {},
  deviceStatus: {},
  deviceFirstSeen: {},
  deviceReturnCounted: {},
};

let mutationChain: Promise<unknown> = Promise.resolve();
let migratedFromJson = false;

type ExperimentRow = {
  id: string;
  name: string;
  key: string;
  description: string;
  status: string;
  variant_a: string;
  variant_b: string;
  rollout_percent: number;
  metric: string;
  result_a: number;
  result_b: number;
  winner: string | null;
  started_at: string | null;
  created_at: string;
  updated_at: string;
};

function rowToExperiment(row: ExperimentRow): ExperimentRecord {
  return {
    id: row.id,
    name: row.name,
    key: row.key,
    description: row.description,
    status: row.status as ExperimentRecord["status"],
    variantA: row.variant_a,
    variantB: row.variant_b,
    rolloutPercent: row.rollout_percent,
    metric: row.metric as ExperimentRecord["metric"],
    resultA: row.result_a,
    resultB: row.result_b,
    winner: row.winner as ExperimentRecord["winner"],
    startedAt: row.started_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function loadFromDb(): ExperimentStore {
  const db = getSqliteDb();
  const experiments = db
    .prepare("SELECT * FROM experiments ORDER BY datetime(created_at) DESC")
    .all()
    .map((row) => rowToExperiment(row as ExperimentRow));

  const stats: Record<string, ExperimentStats> = {};
  const listDevices = db.prepare(
    "SELECT device_id FROM experiment_devices WHERE experiment_id = ? AND variant = ? ORDER BY rowid"
  );
  const listStats = db.prepare("SELECT * FROM experiment_stats WHERE experiment_id = ?");

  for (const exp of experiments) {
    const base = emptyExperimentStats();
    for (const row of listStats.all(exp.id) as Array<{
      variant: "A" | "B";
      exposures: number;
      session_minutes: number;
      launches: number;
      returns: number;
      crashes: number;
    }>) {
      base[row.variant] = {
        exposures: row.exposures,
        uniqueDevices: listDevices.all(exp.id, row.variant).map((d) => (d as { device_id: string }).device_id),
        sessionMinutes: row.session_minutes,
        launches: row.launches,
        returns: row.returns,
        crashes: row.crashes,
      };
    }
    stats[exp.id] = base;
  }

  const deviceStatus: Record<string, string> = {};
  const deviceFirstSeen: Record<string, string> = {};
  const deviceReturnCounted: Record<string, boolean> = {};

  for (const row of db.prepare("SELECT * FROM experiment_device_meta").all() as Array<{
    device_id: string;
    last_status: string | null;
    first_seen: string;
    return_counted: number;
  }>) {
    deviceStatus[row.device_id] = row.last_status ?? "";
    deviceFirstSeen[row.device_id] = row.first_seen;
    deviceReturnCounted[row.device_id] = row.return_counted === 1;
  }

  return { experiments, stats, deviceStatus, deviceFirstSeen, deviceReturnCounted };
}

function saveToDb(store: ExperimentStore): void {
  const db = getSqliteDb();
  const tx = db.transaction(() => {
    const existingIds = new Set(
      (db.prepare("SELECT id FROM experiments").all() as Array<{ id: string }>).map((r) => r.id)
    );
    const nextIds = new Set(store.experiments.map((e) => e.id));

    for (const id of existingIds) {
      if (!nextIds.has(id)) {
        db.prepare("DELETE FROM experiments WHERE id = ?").run(id);
      }
    }

    const upsertExperiment = db.prepare(`
      INSERT INTO experiments (
        id, name, key, description, status, variant_a, variant_b, rollout_percent, metric,
        result_a, result_b, winner, started_at, created_at, updated_at
      ) VALUES (
        @id, @name, @key, @description, @status, @variant_a, @variant_b, @rollout_percent, @metric,
        @result_a, @result_b, @winner, @started_at, @created_at, @updated_at
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        key = excluded.key,
        description = excluded.description,
        status = excluded.status,
        variant_a = excluded.variant_a,
        variant_b = excluded.variant_b,
        rollout_percent = excluded.rollout_percent,
        metric = excluded.metric,
        result_a = excluded.result_a,
        result_b = excluded.result_b,
        winner = excluded.winner,
        started_at = excluded.started_at,
        updated_at = excluded.updated_at
    `);

    const upsertStats = db.prepare(`
      INSERT INTO experiment_stats (
        experiment_id, variant, exposures, session_minutes, launches, returns, crashes
      ) VALUES (
        @experiment_id, @variant, @exposures, @session_minutes, @launches, @returns, @crashes
      )
      ON CONFLICT(experiment_id, variant) DO UPDATE SET
        exposures = excluded.exposures,
        session_minutes = excluded.session_minutes,
        launches = excluded.launches,
        returns = excluded.returns,
        crashes = excluded.crashes
    `);

    const upsertDevice = db.prepare(`
      INSERT OR IGNORE INTO experiment_devices (experiment_id, variant, device_id)
      VALUES (@experiment_id, @variant, @device_id)
    `);

    const upsertMeta = db.prepare(`
      INSERT INTO experiment_device_meta (device_id, last_status, first_seen, return_counted)
      VALUES (@device_id, @last_status, @first_seen, @return_counted)
      ON CONFLICT(device_id) DO UPDATE SET
        last_status = excluded.last_status,
        first_seen = excluded.first_seen,
        return_counted = excluded.return_counted
    `);

    for (const exp of store.experiments) {
      upsertExperiment.run({
        id: exp.id,
        name: exp.name,
        key: exp.key,
        description: exp.description,
        status: exp.status,
        variant_a: exp.variantA,
        variant_b: exp.variantB,
        rollout_percent: exp.rolloutPercent,
        metric: exp.metric,
        result_a: exp.resultA,
        result_b: exp.resultB,
        winner: exp.winner ?? null,
        started_at: exp.startedAt ?? null,
        created_at: exp.createdAt,
        updated_at: exp.updatedAt,
      });

      const expStats = store.stats[exp.id] ?? emptyExperimentStats();
      db.prepare("DELETE FROM experiment_devices WHERE experiment_id = ?").run(exp.id);

      for (const variant of ["A", "B"] as const) {
        const bucket = expStats[variant];
        upsertStats.run({
          experiment_id: exp.id,
          variant,
          exposures: bucket.exposures,
          session_minutes: bucket.sessionMinutes,
          launches: bucket.launches,
          returns: bucket.returns,
          crashes: bucket.crashes,
        });
        for (const deviceId of bucket.uniqueDevices) {
          upsertDevice.run({ experiment_id: exp.id, variant, device_id: deviceId });
        }
      }
    }

    for (const [deviceId, firstSeen] of Object.entries(store.deviceFirstSeen)) {
      upsertMeta.run({
        device_id: deviceId,
        last_status: store.deviceStatus[deviceId] ?? null,
        first_seen: firstSeen,
        return_counted: store.deviceReturnCounted[deviceId] ? 1 : 0,
      });
    }
  });

  tx();
}

function migrateLegacyJsonIfNeeded(): void {
  if (migratedFromJson || hasSqliteExperiments()) {
    migratedFromJson = true;
    return;
  }

  if (!existsSync(LEGACY_FILE)) {
    migratedFromJson = true;
    return;
  }

  try {
    const raw = readFileSync(LEGACY_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<ExperimentStore>;
    const store: ExperimentStore = {
      experiments: Array.isArray(parsed.experiments) ? parsed.experiments : [],
      stats: parsed.stats && typeof parsed.stats === "object" ? parsed.stats : {},
      deviceStatus: parsed.deviceStatus && typeof parsed.deviceStatus === "object" ? parsed.deviceStatus : {},
      deviceFirstSeen:
        parsed.deviceFirstSeen && typeof parsed.deviceFirstSeen === "object" ? parsed.deviceFirstSeen : {},
      deviceReturnCounted:
        parsed.deviceReturnCounted && typeof parsed.deviceReturnCounted === "object"
          ? parsed.deviceReturnCounted
          : {},
    };

    if (store.experiments.length) {
      saveToDb(store);
      getSqliteDb()
        .prepare("INSERT OR REPLACE INTO db_meta (key, value) VALUES (?, ?)")
        .run("experiments_migrated_from_json", new Date().toISOString());
    }
  } catch {
    /* ignore corrupt legacy file */
  }

  migratedFromJson = true;
}

function readStore(): ExperimentStore {
  migrateLegacyJsonIfNeeded();
  const store = loadFromDb();
  return store.experiments.length ? store : { ...EMPTY };
}

export async function loadExperimentStore(): Promise<ExperimentStore> {
  return readStore();
}

export async function mutateExperimentStore(
  fn: (store: ExperimentStore) => ExperimentStore | void
): Promise<ExperimentStore> {
  const run = mutationChain.then(async () => {
    const store = readStore();
    const result = fn(store);
    const next = (result ?? store) as ExperimentStore;
    saveToDb(next);
    return next;
  });
  mutationChain = run.catch(() => undefined);
  return run;
}
