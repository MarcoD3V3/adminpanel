import type { Integration, IntegrationDelivery, IntegrationEventType } from "@/types/features";
import { buildEventPayload, type IntegrationEventPayload } from "./events";
import { buildProviderBody, extraHeaders } from "./providers";
import { listActiveForEvent, recordDelivery } from "./store";

const WEBHOOK_TIMEOUT_MS = 12_000;

function isDeliverableUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") return true;
    return process.env.NODE_ENV !== "production" && parsed.protocol === "http:";
  } catch {
    return false;
  }
}

async function sendToIntegration(
  integration: Integration,
  payload: IntegrationEventPayload,
  force = false
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  if (!force && !integration.active) {
    return { success: false, error: "Integración inactiva" };
  }

  if (!isDeliverableUrl(integration.url) || integration.url.includes("...")) {
    return { success: false, error: "URL de webhook no configurada o inválida" };
  }

  const built = buildProviderBody(integration, payload);
  if (!built.valid || !built.body) {
    return { success: false, error: built.error ?? "Payload inválido" };
  }

  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "CraftLauncher-Integrations/1.0",
      ...(extraHeaders(integration.config) as Record<string, string>),
    };

    const res = await fetch(integration.url, {
      method: "POST",
      headers,
      body: JSON.stringify(built.body),
      signal: ctrl.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        success: false,
        statusCode: res.status,
        error: text.slice(0, 240) || `HTTP ${res.status}`,
      };
    }

    return { success: true, statusCode: res.status };
  } catch (err) {
    clearTimeout(timer);
    const message = err instanceof Error ? err.message : "Error de red";
    return { success: false, error: message };
  }
}

export async function deliverToIntegration(
  integration: Integration,
  payload: IntegrationEventPayload,
  options?: { force?: boolean }
): Promise<IntegrationDeliveryResult> {
  const started = Date.now();
  const result = await sendToIntegration(integration, payload, options?.force);
  const durationMs = Date.now() - started;

  const delivery = recordDelivery({
    integrationId: integration.id,
    integrationName: integration.name,
    event: payload.event,
    success: result.success,
    statusCode: result.statusCode,
    error: result.error,
    durationMs,
    payloadPreview: JSON.stringify(payload).slice(0, 500),
  });

  if (!result.success && integration.config?.retryOnFail) {
    const retry = await sendToIntegration(integration, payload, true);
    if (retry.success) {
      recordDelivery({
        integrationId: integration.id,
        integrationName: integration.name,
        event: payload.event,
        success: true,
        statusCode: retry.statusCode,
        durationMs: Date.now() - started,
        payloadPreview: `[retry] ${JSON.stringify(payload).slice(0, 480)}`,
      });
    }
  }

  return { delivery, ...result };
}

export type IntegrationDeliveryResult = {
  delivery: IntegrationDelivery;
  success: boolean;
  statusCode?: number;
  error?: string;
};

export async function dispatchIntegrationEvent(
  event: IntegrationEventType,
  data: Record<string, unknown> = {}
): Promise<IntegrationDeliveryResult[]> {
  const { loadSystemSettings } = await import("@/lib/settings/store");
  if (!loadSystemSettings().features.integrationsEnabled && event !== "integration.test") {
    return [];
  }

  const payload = buildEventPayload(event, data);
  const targets = listActiveForEvent(event);
  const results: IntegrationDeliveryResult[] = [];

  for (const integration of targets) {
    results.push(await deliverToIntegration(integration, payload));
  }

  return results;
}

export function dispatchIntegrationEventAsync(
  event: IntegrationEventType,
  data: Record<string, unknown> = {}
): void {
  void dispatchIntegrationEvent(event, data).catch(() => undefined);
}

export async function testIntegrationWebhook(integrationId: string) {
  const { getIntegration } = await import("./store");
  const integration = getIntegration(integrationId);
  if (!integration) return null;

  const payload = buildEventPayload("integration.test", {
    message: `Prueba de webhook — ${integration.name}`,
    type: integration.type,
  });

  return deliverToIntegration(integration, payload, { force: true });
}
