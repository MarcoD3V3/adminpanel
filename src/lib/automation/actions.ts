import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { IntegrationEventType } from "@/types/features";
import { dispatchIntegrationEventAsync } from "@/lib/integrations/dispatcher";
import { createNotification } from "@/lib/launcher-notifications/service";
import { revokeLauncherUser } from "@/lib/launcher-auth/service";
import { raiseSecurityAlert } from "@/lib/security/service";
import { enqueueCommand } from "@/lib/live-ops/service";
import { addTempBan, recordChatFlag } from "./store";
import { grantPoints as grantRewardPoints } from "@/lib/rewards/service";
import { loadSystemSettings } from "@/lib/settings/store";
import type { AutomationActionType, AutomationRuleRecord } from "./types";

const DATA_DIR = join(process.cwd(), "data");
const BACKUP_DIR = join(DATA_DIR, "backups");

export type ActionContext = {
  event: string;
  data: Record<string, unknown>;
  rule: AutomationRuleRecord;
};

export async function executeAutomationAction(ctx: ActionContext): Promise<string> {
  const { rule, data } = ctx;
  const cfg = rule.actionConfig;

  switch (rule.actionType as AutomationActionType) {
    case "ban_user_temp": {
      const userId = String(data.userId ?? data.reportedUserId ?? "");
      const username = String(data.username ?? data.reported ?? "unknown");
      const hours = Number(cfg.hours ?? 24);
      if (!userId) return "Sin userId — no se aplicó ban";
      addTempBan({
        userId,
        username,
        hours,
        reason: String(cfg.reason ?? "Automatización"),
        ruleId: rule.id,
      });
      return `Ban temporal ${hours}h para ${username}`;
    }

    case "revoke_user": {
      const userId = String(data.userId ?? "");
      if (!userId) return "Sin userId — no se revocó";
      const ok = await revokeLauncherUser(userId);
      return ok ? `Usuario ${userId} revocado` : "Usuario no encontrado";
    }

    case "notify_launcher": {
      const title = String(cfg.title ?? "Aviso del servidor");
      const message = String(cfg.message ?? data.message ?? "");
      const target = (cfg.target as "all" | "online" | "specific") ?? "all";
      await createNotification({
        title,
        message,
        style: "info",
        display: "toast",
        target,
        targetDevices: target === "specific" ? (cfg.targetDevices as string[] | undefined) : undefined,
      });
      return `Notificación enviada: ${title}`;
    }

    case "create_notification": {
      await createNotification({
        title: String(cfg.title ?? "Aviso"),
        message: String(cfg.message ?? ""),
        style: (cfg.style as "info" | "success" | "warning" | "error") ?? "info",
        display: (cfg.display as "toast" | "alert" | "banner") ?? "toast",
        target: "all",
      });
      return "Notificación creada en cola";
    }

    case "notify_admin":
    case "dispatch_integration": {
      const event = String(cfg.event ?? ctx.event) as IntegrationEventType;
      dispatchIntegrationEventAsync(event, { ...data, ruleId: rule.id, ruleName: rule.name });
      return `Evento ${event} despachado a integraciones`;
    }

    case "flag_for_review": {
      const username = String(data.username ?? data.reported ?? "unknown");
      recordChatFlag(username, String(data.reason ?? cfg.reason ?? "flag_for_review"));
      await raiseSecurityAlert({
        type: "admin_mass_scrape",
        detail: `Marcado para revisión: ${username}`,
        username,
        userId: data.userId as string | undefined,
        metadata: { source: "automation", ruleId: rule.id },
      });
      return `Usuario ${username} marcado para revisión`;
    }

    case "export_data_backup": {
      mkdirSync(BACKUP_DIR, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const copied: string[] = [];
      const dbPath = join(DATA_DIR, "craftlauncher.db");
      if (existsSync(dbPath)) {
        const dest = join(BACKUP_DIR, `craftlauncher-${stamp}.db`);
        copyFileSync(dbPath, dest);
        copied.push(dest);
      }
      for (const file of readdirSync(DATA_DIR)) {
        if (!file.endsWith(".json")) continue;
        const src = join(DATA_DIR, file);
        const dest = join(BACKUP_DIR, `${stamp}-${file}`);
        copyFileSync(src, dest);
        copied.push(dest);
      }
      return copied.length ? `Backup: ${copied.length} archivos` : "Sin archivos para respaldar";
    }

    case "grant_points": {
      const userId = String(data.userId ?? "");
      const username = String(data.username ?? "unknown");
      const points = Number(cfg.points ?? 0);
      if (!userId || points <= 0) return "Sin userId o puntos inválidos";
      const result = grantRewardPoints({
        userId,
        username,
        amount: points,
        reason: String(cfg.message ?? "Automatización"),
        source: "automation",
        metadata: { ruleId: ctx.rule.id },
      });
      const msg = cfg.message as string | undefined;
      if (msg) {
        await createNotification({
          title: "Recompensa",
          message: msg,
          style: "success",
          display: "toast",
          target: "specific",
          targetDevices: data.deviceId ? [String(data.deviceId)] : undefined,
        });
      }
      return `+${points} puntos (${result.points} total) para ${username}`;
    }

    case "enable_maintenance": {
      const { updateSettings } = await import("@/lib/settings/service");
      updateSettings({
        security: {
          maintenanceMode: true,
          maintenanceMessage: String(cfg.message ?? "Mantenimiento programado"),
        },
      });
      dispatchIntegrationEventAsync("maintenance.start", {
        message: cfg.message ?? "Mantenimiento activo",
      });
      return "Modo mantenimiento activado";
    }

    case "run_liveops_message": {
      const deviceId = String(data.deviceId ?? cfg.deviceId ?? "");
      const message = String(cfg.message ?? data.message ?? "");
      if (!deviceId) return "Sin deviceId";
      await enqueueCommand(deviceId, {
        type: "notification",
        title: "Live Ops",
        message,
        style: "info",
        display: "toast",
      });
      return `Mensaje Live Ops → ${deviceId}`;
    }

    default:
      return `Acción no implementada: ${rule.actionType}`;
  }
}

export function isMaintenanceModeEnabled(): boolean {
  return loadSystemSettings().security.maintenanceMode;
}

export function getMaintenanceMessage(): string {
  return loadSystemSettings().security.maintenanceMessage;
}
