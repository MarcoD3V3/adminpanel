import type { IntegrationEventType } from "@/types/features";

export type IntegrationEventDefinition = {
  id: IntegrationEventType;
  label: string;
  description: string;
  category: "usuarios" | "seguridad" | "launcher" | "contenido" | "sistema";
  severity: "info" | "warning" | "critical";
  samplePayload: Record<string, unknown>;
};

export const INTEGRATION_EVENTS: IntegrationEventDefinition[] = [
  { id: "user.ban", label: "Usuario baneado", description: "Un moderador banea una cuenta", category: "usuarios", severity: "critical", samplePayload: { username: "CreeperBoom", reason: "Cliente hackeado", by: "admin" } },
  { id: "user.register", label: "Nuevo registro", description: "Cuenta nueva en el launcher", category: "usuarios", severity: "info", samplePayload: { username: "SteveCraft", tier: "free" } },
  { id: "user.login", label: "Login launcher", description: "Inicio de sesión exitoso", category: "usuarios", severity: "info", samplePayload: { username: "AlexMiner", deviceId: "dev_abc" } },
  { id: "security.critical", label: "Seguridad crítica", description: "Alerta crítica del módulo de seguridad", category: "seguridad", severity: "critical", samplePayload: { type: "launcher_cheat_client", detail: "Wurst detectado", username: "CreeperBoom" } },
  { id: "security.high", label: "Seguridad alta", description: "Alerta de severidad alta", category: "seguridad", severity: "warning", samplePayload: { type: "admin_brute_force", detail: "5 intentos fallidos", ip: "1.2.3.4" } },
  { id: "security.alert", label: "Cualquier alerta", description: "Todas las alertas de seguridad", category: "seguridad", severity: "warning", samplePayload: { type: "admin_cookie_tamper", severity: "critical" } },
  { id: "liveops.alert", label: "Live Ops", description: "Acción remota o alerta de operaciones en vivo", category: "launcher", severity: "warning", samplePayload: { action: "message", target: "device_xyz", message: "Reinicia el launcher" } },
  { id: "launcher.crash", label: "Crash launcher", description: "El launcher o Minecraft reporta crash", category: "launcher", severity: "critical", samplePayload: { version: "1.20.1", error: "Exit -1", deviceId: "dev_abc" } },
  { id: "launcher.online", label: "Usuario online", description: "Umbral de usuarios conectados (batch)", category: "launcher", severity: "info", samplePayload: { online: 42, playing: 18 } },
  { id: "maintenance.start", label: "Mantenimiento inicia", description: "Modo mantenimiento activado", category: "sistema", severity: "warning", samplePayload: { message: "Mantenimiento 2-4 AM", until: "2026-06-14T04:00:00Z" } },
  { id: "maintenance.end", label: "Mantenimiento termina", description: "Servicios restaurados", category: "sistema", severity: "info", samplePayload: { message: "Servicios restaurados" } },
  { id: "experiment.completed", label: "Experimento completado", description: "Test A/B finalizado con ganador", category: "contenido", severity: "info", samplePayload: { name: "Botón Jugar grande", winner: "B", lift: "+12%" } },
  { id: "experiment.started", label: "Experimento iniciado", description: "Nuevo test A/B en ejecución", category: "contenido", severity: "info", samplePayload: { name: "Nuevo UI", rollout: 50 } },
  { id: "modpack.publish", label: "Modpack publicado", description: "Catálogo de modpacks actualizado", category: "contenido", severity: "info", samplePayload: { name: "SkyBlock+", version: "1.20.1" } },
  { id: "chat.flag", label: "Chat flagged", description: "Mensaje reportado en moderación de chat", category: "usuarios", severity: "warning", samplePayload: { reporter: "Steve", reported: "Spammer", reason: "flood" } },
  { id: "notification.sent", label: "Notificación enviada", description: "Push admin a launchers", category: "sistema", severity: "info", samplePayload: { title: "Actualización", target: "all", readCount: 0 } },
  { id: "hub.published", label: "Hub publicado", description: "Layout del hub guardado y publicado", category: "contenido", severity: "info", samplePayload: { screens: 5, updatedBy: "admin" } },
  { id: "token.created", label: "Token creado", description: "Nuevo token de activación generado", category: "usuarios", severity: "info", samplePayload: { tier: "premium", label: "Invitado VIP" } },
  { id: "admin.login", label: "Login admin", description: "Sesión admin iniciada", category: "sistema", severity: "info", samplePayload: { ip: "127.0.0.1" } },
  { id: "integration.test", label: "Prueba webhook", description: "Evento de prueba manual", category: "sistema", severity: "info", samplePayload: { message: "Webhook de prueba CraftLauncher" } },
];

export const INTEGRATION_EVENT_IDS = INTEGRATION_EVENTS.map((e) => e.id);

export const EVENT_BY_ID = Object.fromEntries(INTEGRATION_EVENTS.map((e) => [e.id, e])) as Record<
  IntegrationEventType,
  IntegrationEventDefinition
>;

export function isValidIntegrationEvent(event: string): event is IntegrationEventType {
  return INTEGRATION_EVENT_IDS.includes(event as IntegrationEventType);
}

export type IntegrationEventPayload = {
  event: IntegrationEventType | string;
  title: string;
  message: string;
  severity?: "info" | "warning" | "critical";
  timestamp?: string;
  data?: Record<string, unknown>;
};

export function buildEventPayload(
  event: IntegrationEventType,
  data: Record<string, unknown> = {}
): IntegrationEventPayload {
  const def = EVENT_BY_ID[event];
  return {
    event,
    title: def?.label ?? event,
    message: typeof data.detail === "string" ? data.detail : typeof data.message === "string" ? data.message : def?.description ?? event,
    severity: def?.severity ?? "info",
    timestamp: new Date().toISOString(),
    data,
  };
}
