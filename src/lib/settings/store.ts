import { randomBytes } from "node:crypto";
import { statSync, existsSync } from "node:fs";
import { getSqliteDb } from "@/lib/db/sqlite";
import { dataPath } from "@/lib/data-dir";
import type { PublicLauncherConfig, SettingsPatch, SystemSettings, SystemSettingsPublic } from "./types";

function defaultSettings(): SystemSettings {
  const now = new Date().toISOString();
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
    process.env.VERCEL_URL?.trim()
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

  return {
    api: {
      apiUrl: base,
      wsUrl: process.env.LAUNCHER_WS_URL?.trim() || "wss://ws.craftlauncher.com",
      minLauncherVersion: "1.2.0",
      latestLauncherVersion: "1.2.0",
    },
    oauth: {
      mode: "microsoft",
      clientId: process.env.MICROSOFT_CLIENT_ID?.trim() || "",
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET?.trim() || "",
      redirectUri: `${base}/auth/callback`,
    },
    security: {
      maintenanceMode: false,
      maintenanceMessage: "Mantenimiento programado. Vuelve pronto.",
      forceUpdate: true,
      verifyHwid: false,
      anticheatEnabled: true,
      launcherAuthEnforced: process.env.LAUNCHER_AUTH_ENFORCE !== "false",
    },
    features: {
      experimentsEnabled: true,
      notificationsEnabled: true,
      chatEnabled: true,
      integrationsEnabled: true,
    },
    branding: {
      serverName: "CraftLauncher",
      supportUrl: "https://discord.gg/craftlauncher",
    },
    updatedAt: now,
  };
}

function parsePayload(raw: string | null): SystemSettings {
  if (!raw) return defaultSettings();
  try {
    const parsed = JSON.parse(raw) as SystemSettings;
    return { ...defaultSettings(), ...parsed, api: { ...defaultSettings().api, ...parsed.api }, oauth: { ...defaultSettings().oauth, ...parsed.oauth }, security: { ...defaultSettings().security, ...parsed.security }, features: { ...defaultSettings().features, ...parsed.features }, branding: { ...defaultSettings().branding, ...parsed.branding } };
  } catch {
    return defaultSettings();
  }
}

export function loadSystemSettings(): SystemSettings {
  const row = getSqliteDb().prepare("SELECT payload FROM system_settings WHERE id = 'default'").get() as
    | { payload: string }
    | undefined;
  if (!row) {
    const defaults = defaultSettings();
    saveSystemSettings(defaults);
    return defaults;
  }
  return parsePayload(row.payload);
}

export function saveSystemSettings(settings: SystemSettings): SystemSettings {
  const now = new Date().toISOString();
  const next = { ...settings, updatedAt: now };
  getSqliteDb()
    .prepare(
      `INSERT INTO system_settings (id, payload, updated_at) VALUES ('default', ?, ?)
       ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`
    )
    .run(JSON.stringify(next), now);
  return next;
}

export function patchSystemSettings(patch: SettingsPatch): SystemSettings {
  const current = loadSystemSettings();
  const next: SystemSettings = {
    ...current,
    api: { ...current.api, ...patch.api },
    oauth: { ...current.oauth, ...patch.oauth },
    security: { ...current.security, ...patch.security },
    features: { ...current.features, ...patch.features },
    branding: { ...current.branding, ...patch.branding },
    updatedAt: new Date().toISOString(),
  };
  return saveSystemSettings(next);
}

export function maskSecret(secret: string): string {
  if (!secret) return "";
  if (secret.length <= 4) return "••••";
  return `${"•".repeat(Math.min(secret.length - 4, 12))}${secret.slice(-4)}`;
}

export function toPublicSettings(settings: SystemSettings): SystemSettingsPublic {
  const { clientSecret, ...oauthRest } = settings.oauth;
  return {
    ...settings,
    oauth: {
      ...oauthRest,
      clientSecretMasked: maskSecret(clientSecret),
      secretConfigured: clientSecret.length > 0,
    },
  };
}

export function regenerateOAuthSecret(): SystemSettings {
  const current = loadSystemSettings();
  return saveSystemSettings({
    ...current,
    oauth: {
      ...current.oauth,
      clientSecret: `ms_${randomBytes(24).toString("hex")}`,
    },
  });
}

export function getDbInfo(): { type: string; path: string; sizeKb: number; exists: boolean } {
  const path = dataPath("craftlauncher.db");
  if (!existsSync(path)) {
    return { type: "sqlite", path, sizeKb: 0, exists: false };
  }
  const size = statSync(path).size;
  return { type: "sqlite", path, sizeKb: Math.round(size / 1024), exists: true };
}

export function testDatabaseConnection(): { ok: boolean; message: string } {
  try {
    const row = getSqliteDb().prepare("SELECT 1 AS ok").get() as { ok: number };
    if (row.ok !== 1) return { ok: false, message: "Consulta de prueba falló" };
    return { ok: true, message: "SQLite operativo" };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Error de BD" };
  }
}

export function toLauncherPublicConfig(
  settings: SystemSettings,
  extras: { testerModeEnabled: boolean }
): PublicLauncherConfig {
  return {
    apiUrl: settings.api.apiUrl,
    wsUrl: settings.api.wsUrl,
    minLauncherVersion: settings.api.minLauncherVersion,
    latestLauncherVersion: settings.api.latestLauncherVersion,
    maintenanceMode: settings.security.maintenanceMode,
    maintenanceMessage: settings.security.maintenanceMessage,
    forceUpdate: settings.security.forceUpdate,
    oauthMode: settings.oauth.mode,
    serverName: settings.branding.serverName,
    supportUrl: settings.branding.supportUrl,
    features: settings.features,
    testerModeEnabled: extras.testerModeEnabled,
    launcherAuthEnforced: resolveLauncherAuthEnforced(settings),
  };
}

export function resolveLauncherAuthEnforced(settings?: SystemSettings): boolean {
  if (process.env.LAUNCHER_AUTH_ENFORCE === "false") return false;
  if (process.env.LAUNCHER_AUTH_ENFORCE === "true") return true;
  const s = settings ?? loadSystemSettings();
  return s.security.launcherAuthEnforced;
}

export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/i, "").split(".").map((x) => parseInt(x, 10) || 0);
  const pb = b.replace(/^v/i, "").split(".").map((x) => parseInt(x, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function isLauncherVersionOutdated(version: string, settings?: SystemSettings): boolean {
  const s = settings ?? loadSystemSettings();
  return compareVersions(version, s.api.minLauncherVersion) < 0;
}
