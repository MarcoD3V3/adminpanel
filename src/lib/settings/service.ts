import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { RemoteCommand } from "@craftlauncher/shared";
import { dataPath, getDataDir } from "@/lib/data-dir";
import { isTesterModeEnabled } from "@/lib/launcher-auth/access-settings";
import { listIntegrations } from "@/lib/integrations/store";
import { listExperiments } from "@/lib/experiments/service";
import { setSystemState } from "@/lib/automation/store";
import { emitSystemEvent } from "@/lib/system-events";
import { listPresenceRecords, enqueueCommand } from "@/lib/live-ops/service";
import type { SettingsDashboard, SettingsPatch, SystemSettings } from "./types";
import {
  getDbInfo,
  isLauncherVersionOutdated,
  loadSystemSettings,
  patchSystemSettings,
  regenerateOAuthSecret,
  resolveLauncherAuthEnforced,
  saveSystemSettings,
  testDatabaseConnection,
  toLauncherPublicConfig,
  toPublicSettings,
  compareVersions,
} from "./store";

const BACKUP_DIR = join(getDataDir(), "backups");

export async function getSettingsDashboard(): Promise<SettingsDashboard> {
  const settings = loadSystemSettings();
  const db = getDbInfo();
  const integrations = listIntegrations().filter((i) => i.active);
  const experiments = (await listExperiments()).filter((e) => e.status === "running");

  return {
    settings: toPublicSettings(settings),
    overview: {
      dbType: db.type,
      dbPath: db.path,
      dbSizeKb: db.sizeKb,
      envAuthEnforced: process.env.LAUNCHER_AUTH_ENFORCE !== "false",
      oauthSecretSet: settings.oauth.clientSecret.length > 0,
      maintenanceActive: settings.security.maintenanceMode,
      integrationsActive: integrations.length,
      experimentsRunning: experiments.length,
    },
    links: [
      { id: "security", label: "Seguridad", href: "/security", description: "Alertas y detecciones" },
      { id: "automation", label: "Automatización", href: "/automation", description: "Reglas y mantenimiento" },
      { id: "integrations", label: "Integraciones", href: "/integrations", description: "Webhooks Discord/Telegram" },
      { id: "experiments", label: "Experimentos", href: "/experiments", description: "Tests A/B" },
      { id: "access", label: "Acceso Launcher", href: "/launcher-access", description: "Modo testeo y tokens" },
    ],
  };
}

export async function getPublicLauncherConfig() {
  const settings = loadSystemSettings();
  const testerModeEnabled = await isTesterModeEnabled();
  return toLauncherPublicConfig(settings, { testerModeEnabled });
}

export function updateSettings(patch: SettingsPatch): SystemSettings {
  const prev = loadSystemSettings();
  const next = patchSystemSettings(patch);
  void applySettingsSideEffects(prev, next);
  return next;
}

export function rotateOAuthSecret(): SystemSettings {
  const next = regenerateOAuthSecret();
  void emitSystemEvent("integration.test", { source: "settings", action: "oauth_secret_rotated" });
  return next;
}

export function runDatabaseTest() {
  return testDatabaseConnection();
}

export function runDatabaseBackup(): { ok: boolean; message: string; files: string[] } {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const copied: string[] = [];
  const dbPath = dataPath("craftlauncher.db");
  if (existsSync(dbPath)) {
    const dest = join(BACKUP_DIR, `craftlauncher-${stamp}.db`);
    copyFileSync(dbPath, dest);
    copied.push(dest);
  }
  for (const file of readdirSync(getDataDir())) {
    if (!file.endsWith(".json")) continue;
    const src = join(getDataDir(), file);
    const dest = join(BACKUP_DIR, `${stamp}-${file}`);
    copyFileSync(src, dest);
    copied.push(dest);
  }
  void emitSystemEvent("maintenance.start", { source: "settings_backup", files: copied.length });
  return {
    ok: copied.length > 0,
    message: copied.length ? `${copied.length} archivos respaldados` : "Sin archivos para respaldar",
    files: copied,
  };
}

async function applySettingsSideEffects(prev: SystemSettings, next: SystemSettings): Promise<void> {
  syncMaintenanceState(next);

  if (prev.security.maintenanceMode !== next.security.maintenanceMode) {
    const event = next.security.maintenanceMode ? "maintenance.start" : "maintenance.end";
    emitSystemEvent(event, { message: next.security.maintenanceMessage, source: "settings" });
    await broadcastMaintenanceToLaunchers(next.security.maintenanceMode);
  }

  if (
    prev.api.minLauncherVersion !== next.api.minLauncherVersion ||
    prev.security.forceUpdate !== next.security.forceUpdate
  ) {
    void syncForceUpdateRules(next);
  }

  if (prev.security.anticheatEnabled !== next.security.anticheatEnabled) {
    emitSystemEvent("liveops.alert", {
      action: "anticheat_toggle",
      enabled: next.security.anticheatEnabled,
    });
  }
}

function syncMaintenanceState(settings: SystemSettings): void {
  setSystemState("maintenance_enabled", settings.security.maintenanceMode ? "true" : "false");
  setSystemState("maintenance_message", settings.security.maintenanceMessage);
}

async function broadcastMaintenanceToLaunchers(enabled: boolean): Promise<void> {
  const presences = await listPresenceRecords();
  for (const p of presences) {
    await enqueueCommand(p.deviceId, { type: "maintenance", enabled });
  }
}

async function syncForceUpdateRules(settings: SystemSettings): Promise<void> {
  if (!settings.security.forceUpdate) return;
  const presences = await listPresenceRecords();
  for (const p of presences) {
    if (isLauncherVersionOutdated(p.launcherVersion, settings)) {
      await enqueueCommand(p.deviceId, {
        type: "launcher_update_hint",
        version: settings.api.latestLauncherVersion,
        downloadUrl: settings.branding.launcherDownloadUrl,
      });
    }
  }
}

export async function buildPresenceCommands(
  launcherVersion: string,
  tester: boolean
): Promise<RemoteCommand[]> {
  const settings = loadSystemSettings();
  const commands: RemoteCommand[] = [];

  if (settings.security.maintenanceMode && !tester) {
    commands.push({ type: "maintenance", enabled: true });
    commands.push({
      type: "notification",
      title: settings.branding.serverName,
      message: settings.security.maintenanceMessage,
      style: "warning",
      display: "banner",
    });
  }

  if (
    settings.features.notificationsEnabled &&
    compareVersions(launcherVersion, settings.api.latestLauncherVersion) < 0
  ) {
    commands.push({
      type: "notification",
      title: "Actualización disponible",
      message: `v${settings.api.latestLauncherVersion} ya está publicada. Puedes seguir usando v${launcherVersion}.`,
      style: "update",
      display: "toast",
    });
  }

  return commands;
}

export { resolveLauncherAuthEnforced, loadSystemSettings, isLauncherVersionOutdated };
