import { AUTOMATION_ACTIONS, AUTOMATION_TRIGGERS } from "./catalog";
import {
  createAutomationRule,
  createScheduledJob,
  deleteAutomationRule,
  getAutomationOverview,
  getModerationSettings,
  listAutomationRules,
  listAutomationRuns,
  listScheduledJobs,
  saveModerationSettings,
  updateAutomationRule,
} from "./store";
import { runRuleById } from "./engine";
import { automationTick } from "./scheduler";
import { getIntegrationsDashboard } from "@/lib/integrations/service";
import type { AutomationRuleRecord, ModerationSettings } from "./types";
import type { AutomationScheduledJob } from "./types";

export function getAutomationDashboard() {
  const rules = listAutomationRules().map((rule) => {
    const summary = formatRuleSummary(rule);
    return { ...rule, triggerLabel: summary.trigger, actionLabel: summary.action };
  });
  return {
    rules,
    runs: listAutomationRuns(60),
    jobs: listScheduledJobs(),
    moderation: getModerationSettings(),
    overview: getAutomationOverview(),
    triggers: AUTOMATION_TRIGGERS,
    actions: AUTOMATION_ACTIONS,
    integrations: getIntegrationsDashboard().integrations,
  };
}

export function addAutomationRule(
  input: Omit<AutomationRuleRecord, "id" | "runCount" | "createdAt" | "updatedAt" | "lastRun">
) {
  return createAutomationRule(input);
}

export function patchAutomationRule(id: string, patch: Partial<AutomationRuleRecord>) {
  return updateAutomationRule(id, patch);
}

export function removeAutomationRule(id: string) {
  return deleteAutomationRule(id);
}

export function updateModeration(settings: ModerationSettings) {
  return saveModerationSettings(settings);
}

export function scheduleJob(
  job: Omit<AutomationScheduledJob, "id" | "status" | "lastRunAt" | "nextRunAt">
) {
  return createScheduledJob(job);
}

export async function tickAutomation() {
  return automationTick();
}

export async function testAutomationRule(ruleId: string) {
  return runRuleById(ruleId, { source: "admin_test" });
}

export function formatRuleSummary(rule: AutomationRuleRecord): { trigger: string; action: string } {
  const triggerDef = AUTOMATION_TRIGGERS.find((t) => t.id === rule.triggerType);
  const actionDef = AUTOMATION_ACTIONS.find((a) => a.id === rule.actionType);
  let trigger = triggerDef?.label ?? rule.triggerType;
  let action = actionDef?.label ?? rule.actionType;

  if (rule.triggerType === "chat.flags_threshold") {
    trigger = `${rule.triggerConfig.count ?? 3} flags en ${rule.triggerConfig.windowMinutes ?? 5} min`;
  }
  if (rule.triggerType === "launcher.version_below") {
    trigger = `Launcher < v${rule.triggerConfig.minVersion ?? "?"}`;
  }
  if (rule.triggerType === "cron") {
    trigger = `Cron ${String(rule.triggerConfig.hour ?? 0).padStart(2, "0")}:${String(rule.triggerConfig.minute ?? 0).padStart(2, "0")} UTC`;
  }
  if (rule.actionType === "ban_user_temp") {
    action = `Ban temporal ${rule.actionConfig.hours ?? 24}h`;
  }
  if (rule.actionType === "grant_points") {
    action = `+${rule.actionConfig.points ?? 0} puntos`;
  }

  return { trigger, action };
}
