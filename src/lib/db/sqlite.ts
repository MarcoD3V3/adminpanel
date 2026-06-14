import { mkdirSync, readFileSync, existsSync } from "node:fs";
import Database from "better-sqlite3";
import { dataPath, getDataDir } from "@/lib/data-dir";

let db: Database.Database | null = null;

export function getSqliteDb(): Database.Database {
  if (db) return db;

  mkdirSync(getDataDir(), { recursive: true });
  const instance = new Database(dataPath("craftlauncher.db"));
  instance.pragma("journal_mode = WAL");
  instance.pragma("foreign_keys = ON");
  initSchema(instance);
  db = instance;
  return instance;
}

function initSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS experiments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      key TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      variant_a TEXT NOT NULL,
      variant_b TEXT NOT NULL,
      rollout_percent INTEGER NOT NULL,
      metric TEXT NOT NULL,
      result_a REAL NOT NULL DEFAULT 0,
      result_b REAL NOT NULL DEFAULT 0,
      winner TEXT,
      started_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS experiment_stats (
      experiment_id TEXT NOT NULL,
      variant TEXT NOT NULL CHECK(variant IN ('A', 'B')),
      exposures INTEGER NOT NULL DEFAULT 0,
      session_minutes REAL NOT NULL DEFAULT 0,
      launches INTEGER NOT NULL DEFAULT 0,
      returns INTEGER NOT NULL DEFAULT 0,
      crashes INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (experiment_id, variant),
      FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS experiment_devices (
      experiment_id TEXT NOT NULL,
      variant TEXT NOT NULL CHECK(variant IN ('A', 'B')),
      device_id TEXT NOT NULL,
      PRIMARY KEY (experiment_id, variant, device_id),
      FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS experiment_device_meta (
      device_id TEXT PRIMARY KEY,
      last_status TEXT,
      first_seen TEXT NOT NULL,
      return_counted INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS db_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS security_rules (
      id TEXT PRIMARY KEY,
      detection_type TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      action TEXT NOT NULL,
      source TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS security_alerts (
      id TEXT PRIMARY KEY,
      detection_type TEXT NOT NULL,
      source TEXT NOT NULL,
      severity TEXT NOT NULL,
      username TEXT NOT NULL,
      user_id TEXT NOT NULL DEFAULT '',
      device_id TEXT,
      ip TEXT,
      detail TEXT NOT NULL,
      metadata TEXT,
      resolved INTEGER NOT NULL DEFAULT 0,
      detected_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_security_alerts_open ON security_alerts(resolved, detected_at);
    CREATE INDEX IF NOT EXISTS idx_security_alerts_type ON security_alerts(detection_type, detected_at);

    CREATE TABLE IF NOT EXISTS security_client_hits (
      name TEXT PRIMARY KEY,
      detection_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      hit_count INTEGER NOT NULL DEFAULT 1,
      last_seen_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS integrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('discord', 'telegram', 'slack', 'custom')),
      url TEXT NOT NULL,
      events TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      description TEXT NOT NULL DEFAULT '',
      config TEXT,
      success_rate REAL NOT NULL DEFAULT 100,
      total_deliveries INTEGER NOT NULL DEFAULT 0,
      failed_deliveries INTEGER NOT NULL DEFAULT 0,
      last_triggered TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS integration_deliveries (
      id TEXT PRIMARY KEY,
      integration_id TEXT NOT NULL,
      integration_name TEXT NOT NULL,
      event TEXT NOT NULL,
      success INTEGER NOT NULL,
      status_code INTEGER,
      error TEXT,
      duration_ms INTEGER NOT NULL,
      payload_preview TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_integration_deliveries_created ON integration_deliveries(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_integration_deliveries_event ON integration_deliveries(event, created_at DESC);

    CREATE TABLE IF NOT EXISTS automation_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      trigger_config TEXT NOT NULL DEFAULT '{}',
      action_type TEXT NOT NULL,
      action_config TEXT NOT NULL DEFAULT '{}',
      enabled INTEGER NOT NULL DEFAULT 1,
      run_count INTEGER NOT NULL DEFAULT 0,
      last_run TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS automation_runs (
      id TEXT PRIMARY KEY,
      rule_id TEXT NOT NULL,
      rule_name TEXT NOT NULL,
      trigger_event TEXT NOT NULL,
      success INTEGER NOT NULL,
      detail TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_automation_runs_created ON automation_runs(created_at DESC);

    CREATE TABLE IF NOT EXISTS automation_scheduled_jobs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      action TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      recurring TEXT,
      target TEXT NOT NULL DEFAULT 'all',
      payload TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending',
      last_run_at TEXT,
      next_run_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS automation_moderation (
      id TEXT PRIMARY KEY DEFAULT 'default',
      word_filter INTEGER NOT NULL DEFAULT 1,
      spam_detect INTEGER NOT NULL DEFAULT 1,
      block_links INTEGER NOT NULL DEFAULT 1,
      slow_mode INTEGER NOT NULL DEFAULT 0,
      blacklist TEXT NOT NULL DEFAULT '[]',
      flagged_action TEXT NOT NULL DEFAULT 'mute_24h',
      report_action TEXT NOT NULL DEFAULT 'notify',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS automation_chat_flags (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      reason TEXT,
      flagged_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_automation_chat_flags_user ON automation_chat_flags(username, flagged_at);

    CREATE TABLE IF NOT EXISTS automation_temp_bans (
      user_id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      until_at TEXT NOT NULL,
      reason TEXT,
      rule_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS automation_points (
      user_id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS automation_system_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      id TEXT PRIMARY KEY DEFAULT 'default',
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rewards_economy (
      id TEXT PRIMARY KEY DEFAULT 'default',
      points_per_hour INTEGER NOT NULL DEFAULT 10,
      daily_bonus INTEGER NOT NULL DEFAULT 50,
      referral_bonus INTEGER NOT NULL DEFAULT 200,
      event_bonus INTEGER NOT NULL DEFAULT 100,
      xp_multiplier REAL NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rewards_tiers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      points_required INTEGER NOT NULL DEFAULT 0,
      perks TEXT NOT NULL DEFAULT '[]',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rewards_redeemables (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      cost INTEGER NOT NULL,
      category TEXT NOT NULL DEFAULT 'cosmetic',
      active INTEGER NOT NULL DEFAULT 1,
      stock INTEGER,
      redemptions INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rewards_missions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL,
      metric TEXT NOT NULL,
      target INTEGER NOT NULL,
      reward_points INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      completions INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rewards_users (
      user_id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 0,
      lifetime_points INTEGER NOT NULL DEFAULT 0,
      tier_id TEXT,
      referral_code TEXT,
      referred_by TEXT,
      last_daily_bonus TEXT,
      last_login_date TEXT,
      play_minutes_today INTEGER NOT NULL DEFAULT 0,
      play_day_key TEXT,
      chat_count_today INTEGER NOT NULL DEFAULT 0,
      chat_day_key TEXT,
      last_heartbeat_at TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_rewards_users_points ON rewards_users(points DESC);

    CREATE TABLE IF NOT EXISTS rewards_mission_progress (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      mission_id TEXT NOT NULL,
      period_key TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, mission_id, period_key)
    );

    CREATE TABLE IF NOT EXISTS rewards_redemptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      redeemable_id TEXT NOT NULL,
      redeemable_name TEXT NOT NULL,
      cost INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rewards_point_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      amount INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      reason TEXT NOT NULL,
      source TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_rewards_point_log_user ON rewards_point_log(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS player_portal_prefs (
      user_id TEXT PRIMARY KEY,
      prefs_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS portal_friends (
      user_id TEXT NOT NULL,
      friend_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, friend_user_id)
    );

    CREATE TABLE IF NOT EXISTS portal_messages (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL,
      recipient_id TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_portal_messages_thread ON portal_messages(sender_id, recipient_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_portal_messages_inbox ON portal_messages(recipient_id, created_at DESC);
  `);
}

export function hasSqliteExperiments(): boolean {
  const database = getSqliteDb();
  const row = database.prepare("SELECT COUNT(*) AS count FROM experiments").get() as { count: number };
  return row.count > 0;
}
