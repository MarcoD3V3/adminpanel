import { getModerationSettings, recordChatFlag } from "./store";
import { loadSystemSettings } from "@/lib/settings/store";
import { emitAutomationEvent } from "./engine";

const URL_RE = /https?:\/\/|www\./i;
const SPAM_RE = /(.)\1{6,}|(buy|free|click|discord\.gg)/i;

export type ModerationCheckResult = {
  allowed: boolean;
  reason?: string;
  flagged?: boolean;
};

export function checkChatMessage(text: string, username: string): ModerationCheckResult {
  if (!loadSystemSettings().features.chatEnabled) {
    return { allowed: true };
  }
  const settings = getModerationSettings();
  const normalized = text.trim().toLowerCase();

  if (settings.blockLinks && URL_RE.test(text)) {
    return { allowed: false, reason: "Enlaces no permitidos", flagged: true };
  }

  if (settings.wordFilter) {
    for (const word of settings.blacklist) {
      const w = word.trim().toLowerCase();
      if (w && normalized.includes(w)) {
        return { allowed: false, reason: `Palabra prohibida: ${word}`, flagged: true };
      }
    }
  }

  if (settings.spamDetect && SPAM_RE.test(text)) {
    return { allowed: false, reason: "Detectado como spam", flagged: true };
  }

  return { allowed: true };
}

export function reportChatMessage(input: {
  reporter: string;
  reported: string;
  reason: string;
  userId?: string;
  reportedUserId?: string;
  message?: string;
}): { ok: boolean; flags: number } {
  const settings = getModerationSettings();
  const flags = recordChatFlag(input.reported, input.reason);

  emitAutomationEvent("chat.flag", {
    reporter: input.reporter,
    reported: input.reported,
    reason: input.reason,
    userId: input.reportedUserId,
    username: input.reported,
    message: input.message,
  });

  if (settings.reportAction === "ban" && input.reportedUserId) {
    emitAutomationEvent("user.ban", {
      userId: input.reportedUserId,
      username: input.reported,
      reason: input.reason,
      source: "moderation_report",
    });
  }

  return { ok: true, flags };
}

export function applyFlaggedAction(username: string, userId?: string): void {
  const settings = getModerationSettings();
  const action = settings.flaggedAction;

  emitAutomationEvent("chat.flag", {
    reported: username,
    userId,
    reason: `flagged_action:${action}`,
    action,
  });
}
