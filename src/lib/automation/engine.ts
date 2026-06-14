import type { AutomationRuleRecord } from "./types";
import {
  countChatFlags,
  insertAutomationRun,
  listAutomationRules,
  markRuleRun,
} from "./store";
import { executeAutomationAction } from "./actions";

function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/i, "").split(".").map((x) => parseInt(x, 10) || 0);
  const pb = b.replace(/^v/i, "").split(".").map((x) => parseInt(x, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

const versionNotifyCooldown = new Map<string, number>();
const VERSION_COOLDOWN_MS = 24 * 3600_000;

function ruleMatchesEvent(rule: AutomationRuleRecord, event: string, data: Record<string, unknown>): boolean {
  if (!rule.enabled) return false;

  if (rule.triggerType === event) return true;

  if (rule.triggerType === "security.alert" && event.startsWith("security.")) return true;

  if (rule.triggerType === "launcher.version_below" && (event === "user.login" || event === "launcher.online")) {
    const minVersion = String(rule.triggerConfig.minVersion ?? "0.0.0");
    const version = String(data.launcherVersion ?? data.version ?? "");
    if (!version || compareVersions(version, minVersion) >= 0) return false;
    if (event === "launcher.online") {
      const deviceId = String(data.deviceId ?? "");
      const key = `${rule.id}:${deviceId}`;
      const last = versionNotifyCooldown.get(key) ?? 0;
      if (Date.now() - last < VERSION_COOLDOWN_MS) return false;
      versionNotifyCooldown.set(key, Date.now());
    }
    return true;
  }

  if (rule.triggerType === "user.premium" && (event === "user.login" || event === "user.register")) {
    return data.tier === "premium" || data.premium === true;
  }

  if (rule.triggerType === "chat.flags_threshold" && event === "chat.flag") {
    const count = Number(rule.triggerConfig.count ?? 3);
    const windowMinutes = Number(rule.triggerConfig.windowMinutes ?? 5);
    const username = String(data.reported ?? data.username ?? "");
    if (!username) return false;
    const flags = countChatFlags(username, windowMinutes);
    return flags >= count;
  }

  return false;
}

async function runRule(rule: AutomationRuleRecord, event: string, data: Record<string, unknown>): Promise<void> {
  try {
    const detail = await executeAutomationAction({ event, data, rule });
    markRuleRun(rule.id);
    insertAutomationRun({
      ruleId: rule.id,
      ruleName: rule.name,
      triggerEvent: event,
      success: true,
      detail,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Error desconocido";
    insertAutomationRun({
      ruleId: rule.id,
      ruleName: rule.name,
      triggerEvent: event,
      success: false,
      detail,
    });
  }
}

export function emitAutomationEvent(event: string, data: Record<string, unknown> = {}): void {
  void processAutomationEvent(event, data);
}

export async function processAutomationEvent(event: string, data: Record<string, unknown> = {}): Promise<number> {
  const rules = listAutomationRules();
  let ran = 0;

  for (const rule of rules) {
    if (!ruleMatchesEvent(rule, event, data)) continue;
    await runRule(rule, event, data);
    ran += 1;
  }

  return ran;
}

export async function runRuleById(ruleId: string, data: Record<string, unknown> = {}): Promise<boolean> {
  const rule = listAutomationRules().find((r) => r.id === ruleId);
  if (!rule) return false;
  await runRule(rule, "manual", data);
  return true;
}
