import type { Integration, IntegrationConfig } from "@/types/features";
import { INTEGRATION_EVENTS, isValidIntegrationEvent } from "./events";
import { testIntegrationWebhook } from "./dispatcher";
import {
  createIntegration,
  deleteIntegration,
  getIntegrationOverview,
  listDeliveries,
  listIntegrations,
  updateIntegration,
} from "./store";

export function getIntegrationsDashboard() {
  return {
    integrations: listIntegrations(),
    overview: getIntegrationOverview(),
    events: INTEGRATION_EVENTS,
    deliveries: listDeliveries(50),
  };
}

export function validateIntegrationInput(input: {
  name?: string;
  type?: string;
  url?: string;
  events?: string[];
}): string | null {
  if (!input.name?.trim()) return "Nombre requerido";
  if (!input.url?.trim()) return "URL requerida";
  if (!["discord", "telegram", "slack", "custom"].includes(input.type ?? "")) return "Tipo inválido";
  try {
    const parsed = new URL(input.url.trim());
    if (parsed.protocol !== "https:" && process.env.NODE_ENV === "production") {
      return "La URL debe ser HTTPS en producción";
    }
  } catch {
    return "URL inválida";
  }
  const events = input.events ?? [];
  if (!events.length) return "Selecciona al menos un evento";
  if (events.some((e) => !isValidIntegrationEvent(e))) return "Evento no válido en la lista";
  return null;
}

export async function addIntegration(input: {
  name: string;
  type: Integration["type"];
  url: string;
  events: string[];
  description?: string;
  config?: IntegrationConfig;
}): Promise<Integration> {
  const error = validateIntegrationInput(input);
  if (error) throw new Error(error);
  return createIntegration(input);
}

export async function patchIntegration(
  id: string,
  patch: Partial<{
    name: string;
    type: Integration["type"];
    url: string;
    events: string[];
    active: boolean;
    description: string;
    config: IntegrationConfig;
  }>
): Promise<Integration | null> {
  if (patch.url || patch.type || patch.events) {
    const existing = listIntegrations().find((i) => i.id === id);
    const error = validateIntegrationInput({
      name: patch.name ?? existing?.name,
      type: patch.type ?? existing?.type,
      url: patch.url ?? existing?.url,
      events: patch.events ?? existing?.events,
    });
    if (error) throw new Error(error);
  }
  return updateIntegration(id, patch);
}

export async function removeIntegration(id: string) {
  return deleteIntegration(id);
}

export async function runIntegrationTest(id: string) {
  return testIntegrationWebhook(id);
}

export function getDeliveriesLog(limit = 100, integrationId?: string) {
  return listDeliveries(limit, integrationId);
}
