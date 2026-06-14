import type { AutomationActionType, AutomationTriggerType } from "./types";

export type TriggerDef = {
  id: AutomationTriggerType;
  label: string;
  description: string;
  configFields?: string[];
};

export type ActionDef = {
  id: AutomationActionType;
  label: string;
  description: string;
  configFields?: string[];
};

export const AUTOMATION_TRIGGERS: TriggerDef[] = [
  { id: "security.critical", label: "Alerta crítica", description: "Dispara con alertas de seguridad críticas" },
  { id: "security.high", label: "Alerta alta", description: "Alertas de severidad alta" },
  { id: "security.alert", label: "Cualquier alerta", description: "Todas las alertas de seguridad" },
  { id: "chat.flag", label: "Mensaje reportado", description: "Un mensaje de chat es marcado" },
  { id: "chat.flags_threshold", label: "Umbral de flags chat", description: "X flags en Y minutos para un usuario", configFields: ["count", "windowMinutes"] },
  { id: "user.login", label: "Login launcher", description: "Usuario inicia sesión" },
  { id: "user.register", label: "Registro", description: "Nueva cuenta creada" },
  { id: "user.premium", label: "Usuario premium", description: "Login o registro con tier premium" },
  { id: "launcher.version_below", label: "Launcher obsoleto", description: "Versión por debajo del mínimo", configFields: ["minVersion"] },
  { id: "experiment.completed", label: "Experimento completado", description: "Test A/B finalizado" },
  { id: "token.created", label: "Token creado", description: "Nuevo token de activación" },
  { id: "hub.published", label: "Hub publicado", description: "Layout del hub guardado" },
  { id: "notification.sent", label: "Notificación enviada", description: "Push a launchers" },
  { id: "liveops.alert", label: "Live Ops", description: "Acción de operaciones en vivo" },
  { id: "cron", label: "Programado (cron)", description: "Ejecución recurrente UTC", configFields: ["hour", "minute"] },
];

export const AUTOMATION_ACTIONS: ActionDef[] = [
  { id: "ban_user_temp", label: "Ban temporal", description: "Revoca acceso por N horas", configFields: ["hours", "reason"] },
  { id: "revoke_user", label: "Revocar usuario", description: "Desactiva cuenta permanentemente" },
  { id: "notify_launcher", label: "Notificar launchers", description: "Push a todos o online", configFields: ["title", "message", "target"] },
  { id: "notify_admin", label: "Notificar admin", description: "Evento a integraciones/webhooks" },
  { id: "dispatch_integration", label: "Webhook integración", description: "Dispara evento de integración", configFields: ["event"] },
  { id: "create_notification", label: "Crear notificación", description: "Cola de notificaciones launcher", configFields: ["title", "message"] },
  { id: "flag_for_review", label: "Marcar revisión", description: "Registra para moderación manual" },
  { id: "export_data_backup", label: "Backup datos", description: "Exporta BD y configs locales" },
  { id: "grant_points", label: "Otorgar puntos", description: "Puntos de recompensa (registro)", configFields: ["points"] },
  { id: "enable_maintenance", label: "Modo mantenimiento", description: "Activa mantenimiento", configFields: ["message"] },
  { id: "run_liveops_message", label: "Mensaje Live Ops", description: "Mensaje a dispositivo específico", configFields: ["message"] },
];

export const TRIGGER_BY_ID = Object.fromEntries(AUTOMATION_TRIGGERS.map((t) => [t.id, t])) as Record<
  AutomationTriggerType,
  TriggerDef
>;

export const ACTION_BY_ID = Object.fromEntries(AUTOMATION_ACTIONS.map((a) => [a.id, a])) as Record<
  AutomationActionType,
  ActionDef
>;
