import type { AlertSeverity, SecurityDetectionType, SecurityRule, SecuritySource } from "@/types/features";

export type DetectionDefinition = {
  type: SecurityDetectionType;
  source: SecuritySource;
  name: string;
  description: string;
  severity: AlertSeverity;
  action: SecurityRule["action"];
};

export const SECURITY_DETECTIONS: DetectionDefinition[] = [
  { type: "admin_cookie_tamper", source: "admin", name: "Cookie admin alterada", description: "Firma o formato inválido en cl_admin_session", severity: "critical", action: "notify_admin" },
  { type: "admin_session_hijack", source: "admin", name: "Sesión admin desde IP nueva", description: "Misma cookie usada desde IP distinta en poco tiempo", severity: "high", action: "notify_admin" },
  { type: "admin_csrf_origin", source: "admin", name: "Origen cross-site", description: "Petición admin desde origen no permitido", severity: "high", action: "flag" },
  { type: "admin_brute_force", source: "admin", name: "Fuerza bruta admin", description: "Múltiples claves admin incorrectas", severity: "critical", action: "notify_admin" },
  { type: "admin_xss_attempt", source: "admin", name: "Intento XSS", description: "Payload script/HTML en body o query", severity: "high", action: "flag" },
  { type: "admin_sql_injection", source: "admin", name: "Inyección SQL", description: "Patrones SQLi en entrada de API", severity: "critical", action: "notify_admin" },
  { type: "admin_path_traversal", source: "admin", name: "Path traversal", description: "Secuencias ../ o rutas sospechosas", severity: "high", action: "flag" },
  { type: "admin_unauthorized_api", source: "admin", name: "API sin autorización", description: "Acceso a endpoint admin sin sesión", severity: "medium", action: "flag" },
  { type: "admin_rate_limit", source: "admin", name: "Rate limit excedido", description: "Demasiadas peticiones en ventana corta", severity: "medium", action: "flag" },
  { type: "admin_privilege_escalation", source: "admin", name: "Escalada de privilegios", description: "X-Admin-Key inválida o manipulada", severity: "critical", action: "notify_admin" },
  { type: "admin_hub_lock_bypass", source: "admin", name: "Bypass lock hub", description: "Edición hub sin lock o holder inválido", severity: "high", action: "flag" },
  { type: "admin_data_tamper", source: "admin", name: "Datos alterados", description: "Campos protegidos o IDs inyectados en body", severity: "high", action: "flag" },
  { type: "admin_header_spoof", source: "admin", name: "Headers anómalos", description: "User-Agent vacío, bots o cabeceras de ataque", severity: "low", action: "flag" },
  { type: "admin_mass_scrape", source: "admin", name: "Scraping masivo", description: "Muchas lecturas API admin en poco tiempo", severity: "medium", action: "notify_admin" },
  { type: "admin_token_replay", source: "admin", name: "Token reutilizado", description: "Token de activación ya consumido", severity: "high", action: "ban" },
  { type: "launcher_cheat_client", source: "launcher", name: "Cliente hackeado", description: "Cliente cheat conocido en classpath", severity: "critical", action: "ban" },
  { type: "launcher_modified_jar", source: "launcher", name: "JAR modificado", description: "Hash de minecraft.jar no coincide", severity: "high", action: "kick" },
  { type: "launcher_hwid_mismatch", source: "launcher", name: "HWID sospechoso", description: "Huella de dispositivo cambió rápidamente", severity: "medium", action: "flag" },
  { type: "launcher_suspicious_mod", source: "launcher", name: "Mod no permitido", description: "Mod fuera de whitelist detectado", severity: "low", action: "flag" },
  { type: "launcher_code_injection", source: "launcher", name: "Inyección de código", description: "Eval/Function o scripts inyectados", severity: "critical", action: "ban" },
  { type: "launcher_debugger_attached", source: "launcher", name: "Debugger adjunto", description: "Depurador conectado al proceso", severity: "high", action: "kick" },
  { type: "launcher_ssl_pin_bypass", source: "launcher", name: "Bypass SSL", description: "Certificados o pinning manipulados", severity: "high", action: "kick" },
  { type: "launcher_token_theft", source: "launcher", name: "Robo de token", description: "Sesión activa en otro dispositivo simultáneo", severity: "critical", action: "ban" },
  { type: "launcher_heartbeat_anomaly", source: "launcher", name: "Heartbeat anómalo", description: "RAM/CPU/status incoherentes en heartbeat", severity: "medium", action: "flag" },
  { type: "launcher_file_tamper", source: "launcher", name: "Archivos alterados", description: "Binarios o assets del launcher modificados", severity: "high", action: "kick" },
  { type: "launcher_env_tamper", source: "launcher", name: "Entorno manipulado", description: "Variables de entorno o args sospechosos", severity: "medium", action: "flag" },
  { type: "launcher_proxy_mitm", source: "launcher", name: "Proxy/MITM", description: "Interceptación de tráfico detectada", severity: "high", action: "kick" },
  { type: "launcher_bot_automation", source: "launcher", name: "Automatización/bot", description: "Patrones de input no humanos", severity: "medium", action: "flag" },
  { type: "launcher_unsigned_binary", source: "launcher", name: "Binario sin firma", description: "Ejecutable sin firma digital válida", severity: "high", action: "kick" },
  { type: "launcher_login_brute", source: "launcher", name: "Fuerza bruta launcher", description: "Muchos logins fallidos desde mismo dispositivo/IP", severity: "high", action: "ban" },
];

export const DETECTION_BY_TYPE = Object.fromEntries(
  SECURITY_DETECTIONS.map((d) => [d.type, d])
) as Record<SecurityDetectionType, DetectionDefinition>;

export function defaultSecurityRules(): SecurityRule[] {
  return SECURITY_DETECTIONS.map((d, i) => ({
    id: `sr_${String(i + 1).padStart(2, "0")}`,
    detectionType: d.type,
    name: d.name,
    description: d.description,
    enabled: true,
    action: d.action,
    source: d.source,
  }));
}

export const detectionTypeLabels: Record<SecurityDetectionType, string> = Object.fromEntries(
  SECURITY_DETECTIONS.map((d) => [d.type, d.name])
) as Record<SecurityDetectionType, string>;
