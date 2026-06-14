import type { IntegrationEventType } from "@/types/features";

/** Emite un evento del ecosistema → integraciones + reglas de automatización. */
export function emitSystemEvent(event: IntegrationEventType | string, data: Record<string, unknown> = {}): void {
  void import("@/lib/integrations/dispatcher")
    .then(({ dispatchIntegrationEventAsync }) => {
      if (isIntegrationEvent(event)) {
        dispatchIntegrationEventAsync(event, data);
      }
    })
    .catch(() => {});
  void import("@/lib/automation/engine")
    .then(({ emitAutomationEvent }) => {
      emitAutomationEvent(event, data);
    })
    .catch(() => {});
}

function isIntegrationEvent(event: string): event is IntegrationEventType {
  const known = [
    "user.ban", "user.register", "user.login", "security.critical", "security.high", "security.alert",
    "liveops.alert", "launcher.crash", "launcher.online", "maintenance.start", "maintenance.end",
    "experiment.completed", "experiment.started", "modpack.publish", "chat.flag", "notification.sent",
    "hub.published", "token.created", "admin.login", "integration.test",
  ];
  return known.includes(event);
}
