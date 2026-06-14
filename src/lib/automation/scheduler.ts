import { createNotification } from "@/lib/launcher-notifications/service";
import { listPresenceRecords } from "@/lib/live-ops/service";
import { dispatchIntegrationEventAsync } from "@/lib/integrations/dispatcher";
import { processAutomationEvent } from "./engine";
import {
  listAutomationRules,
  listScheduledJobs,
  updateScheduledJobStatus,
} from "./store";

let lastCronKey = "";

export async function processCronRules(): Promise<number> {
  const now = new Date();
  const key = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}-${now.getUTCMinutes()}`;
  if (key === lastCronKey) return 0;
  lastCronKey = key;

  const rules = listAutomationRules().filter((r) => r.enabled && r.triggerType === "cron");
  let ran = 0;

  for (const rule of rules) {
    const hour = Number(rule.triggerConfig.hour ?? 0);
    const minute = Number(rule.triggerConfig.minute ?? 0);
    if (now.getUTCHours() !== hour || now.getUTCMinutes() !== minute) continue;
    ran += await processAutomationEvent("cron", { ruleId: rule.id, hour, minute });
  }

  return ran;
}

export async function processScheduledJobs(): Promise<number> {
  const now = Date.now();
  const jobs = listScheduledJobs().filter((j) => j.status === "pending" && Date.parse(j.scheduledAt) <= now);
  let ran = 0;

  for (const job of jobs) {
    updateScheduledJobStatus(job.id, "running");
    try {
      await executeScheduledJob(job);
      updateScheduledJobStatus(job.id, "completed");
      ran += 1;
    } catch {
      updateScheduledJobStatus(job.id, "cancelled");
    }
  }

  return ran;
}

async function executeScheduledJob(job: ReturnType<typeof listScheduledJobs>[number]): Promise<void> {
  const payload = job.payload ?? {};

  switch (job.action) {
    case "maintenance": {
      const { updateSettings } = await import("@/lib/settings/service");
      updateSettings({
        security: {
          maintenanceMode: true,
          maintenanceMessage: String(payload.message ?? job.name),
        },
      });
      dispatchIntegrationEventAsync("maintenance.start", { message: payload.message ?? job.name });
      break;
    }
    case "notification": {
      await createNotification({
        title: String(payload.title ?? job.name),
        message: String(payload.message ?? ""),
        style: (payload.style as "info") ?? "info",
        display: "toast",
        target: job.target === "online" ? "all" : job.target,
      });
      break;
    }
    case "force_update": {
      const presences = await listPresenceRecords();
      const targets =
        job.target === "online"
          ? presences
          : job.target === "premium"
            ? presences.filter((p) => p.premium)
            : presences;
      const { enqueueCommand } = await import("@/lib/live-ops/service");
      for (const p of targets) {
        await enqueueCommand(p.deviceId, {
          type: "force_update",
          version: String(payload.version ?? "latest"),
        });
      }
      break;
    }
    case "broadcast": {
      await createNotification({
        title: String(payload.title ?? "Broadcast"),
        message: String(payload.message ?? ""),
        style: "info",
        display: "banner",
        target: "all",
      });
      break;
    }
    case "double_xp": {
      const { updateEconomy } = await import("@/lib/rewards/service");
      const mult = Number(payload.multiplier ?? 2);
      updateEconomy({ xpMultiplier: mult });
      dispatchIntegrationEventAsync("liveops.alert", { action: "double_xp", multiplier: mult });
      break;
    }
    default:
      await processAutomationEvent("cron", { jobId: job.id, action: job.action, ...payload });
  }
}

export async function automationTick(): Promise<{ cron: number; jobs: number; temporaryPurged: number }> {
  const { purgeExpiredTemporaryProfiles } = await import("@/lib/launcher-auth/service");
  const temporaryPurged = await purgeExpiredTemporaryProfiles("automation_tick");
  const cron = await processCronRules();
  const jobs = await processScheduledJobs();
  return { cron, jobs, temporaryPurged };
}
