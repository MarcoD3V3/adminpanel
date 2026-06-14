import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionValue } from "@/lib/launcher-auth/admin-session";
import { assertAdminKey, clientIp, isSameOriginAdminRequest } from "@/lib/launcher-auth/http";
import type { SecurityDetectionType } from "@/types/features";
import { raiseSecurityAlert, trackAdminSessionIp } from "./service";
import { isSuspiciousUserAgent, matchCheatClient, scanObjectForThreats, scanUrlForThreats } from "./scanner";

const scrapeBuckets = new Map<string, { count: number; resetAt: number }>();

function trackMassScrape(ip: string): void {
  const now = Date.now();
  const bucket = scrapeBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    scrapeBuckets.set(ip, { count: 1, resetAt: now + 60_000 });
    return;
  }
  bucket.count += 1;
  if (bucket.count === 40) {
    void raiseSecurityAlert({
      type: "admin_mass_scrape",
      ip,
      detail: `Scraping masivo: ${bucket.count} lecturas API en 1 min desde ${ip}`,
    });
  }
}

export async function auditUnauthorizedAdmin(path: string, ip: string): Promise<void> {
  const jar = await cookies();
  const cookie = jar.get(ADMIN_SESSION_COOKIE)?.value;

  if (cookie) {
    if (!verifyAdminSessionValue(cookie)) {
      await raiseSecurityAlert({
        type: "admin_cookie_tamper",
        ip,
        detail: `Cookie admin alterada o firma inválida al acceder a ${path}`,
        metadata: { path },
      });
      return;
    }
    trackAdminSessionIp(cookie, ip);
  }

  await raiseSecurityAlert({
    type: "admin_unauthorized_api",
    ip,
    detail: `Acceso no autorizado a ${path}`,
    metadata: { path },
  });
}

export async function auditAdminOriginBlocked(request: Request): Promise<void> {
  await raiseSecurityAlert({
    type: "admin_csrf_origin",
    ip: clientIp(request),
    detail: `Origen no permitido: ${request.headers.get("origin") ?? request.headers.get("referer") ?? "desconocido"}`,
    metadata: {
      origin: request.headers.get("origin"),
      referer: request.headers.get("referer"),
      path: new URL(request.url).pathname,
    },
  });
}

export async function auditAdminLoginFailed(request: Request): Promise<void> {
  await raiseSecurityAlert({
    type: "admin_brute_force",
    ip: clientIp(request),
    detail: "Intento de login admin con clave incorrecta",
  });
}

export async function auditAdminRateLimit(request: Request, context: string): Promise<void> {
  await raiseSecurityAlert({
    type: "admin_rate_limit",
    ip: clientIp(request),
    detail: `Rate limit excedido: ${context}`,
    metadata: { context },
  });
}

export async function auditInvalidAdminKey(request: Request): Promise<void> {
  await raiseSecurityAlert({
    type: "admin_privilege_escalation",
    ip: clientIp(request),
    detail: "Cabecera X-Admin-Key inválida en petición privilegiada",
  });
}

export async function auditAdminRequest(request: Request, body?: unknown): Promise<SecurityDetectionType | null> {
  const ip = clientIp(request);
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (method === "GET" && url.pathname.startsWith("/api/")) {
    trackMassScrape(ip);
  }

  if (!isSameOriginAdminRequest(request) && method !== "GET" && method !== "OPTIONS") {
    await auditAdminOriginBlocked(request);
  }

  if (isSuspiciousUserAgent(request.headers.get("user-agent"))) {
    await raiseSecurityAlert({
      type: "admin_header_spoof",
      ip,
      detail: `User-Agent sospechoso: ${request.headers.get("user-agent") ?? "(vacío)"}`,
    });
  }

  const urlHit = scanUrlForThreats(url.pathname + url.search);
  if (urlHit) {
    await raiseSecurityAlert({ type: urlHit, ip, detail: `Patrón detectado en URL: ${url.pathname}` });
    return urlHit;
  }

  if (body !== undefined) {
    const bodyHit = scanObjectForThreats(body);
    if (bodyHit) {
      await raiseSecurityAlert({
        type: bodyHit,
        ip,
        detail: `Patrón detectado en body de ${method} ${url.pathname}`,
        metadata: { path: url.pathname },
      });
      return bodyHit;
    }
  }

  const adminKey = request.headers.get("x-admin-key");
  if (adminKey && !assertAdminKey(adminKey)) {
    await auditInvalidAdminKey(request);
    return "admin_privilege_escalation";
  }

  return null;
}

export async function auditLauncherLoginFailed(ip: string, deviceId: string, reason: string): Promise<void> {
  await raiseSecurityAlert({
    type: "launcher_login_brute",
    ip,
    deviceId,
    detail: `Login launcher fallido (${reason})`,
    username: deviceId.slice(0, 12),
  });
}

export async function auditLauncherRateLimit(ip: string, deviceId: string): Promise<void> {
  await raiseSecurityAlert({
    type: "launcher_login_brute",
    ip,
    deviceId,
    detail: "Rate limit de login launcher superado",
    username: deviceId.slice(0, 12),
  });
}

export async function auditHeartbeatAnomaly(
  deviceId: string,
  ip: string,
  ram: number,
  cpu: number,
  status: string
): Promise<void> {
  const { loadSystemSettings } = await import("@/lib/settings/store");
  const settings = loadSystemSettings();
  if (!settings.security.anticheatEnabled) return;

  if (ram < 0 || ram > 128 || cpu < 0 || cpu > 100) {
    await raiseSecurityAlert({
      type: "launcher_heartbeat_anomaly",
      deviceId,
      ip,
      username: deviceId.slice(0, 12),
      detail: `Heartbeat incoherente: RAM=${ram}% CPU=${cpu}% status=${status}`,
      metadata: { ram, cpu, status },
    });
  }
}

export async function auditLauncherReport(input: {
  type: SecurityDetectionType;
  detail: string;
  deviceId?: string;
  username?: string;
  userId?: string;
  ip?: string;
  clientName?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  let clientName = input.clientName;
  if (!clientName && input.type === "launcher_cheat_client") {
    clientName = matchCheatClient(input.detail) ?? input.detail.slice(0, 64);
  }
  if (!clientName && input.type === "launcher_suspicious_mod") {
    clientName = input.detail.slice(0, 64);
  }

  await raiseSecurityAlert({ ...input, clientName });
}

export async function auditHubLockBypass(ip: string, editorId: string): Promise<void> {
  await raiseSecurityAlert({
    type: "admin_hub_lock_bypass",
    ip,
    detail: `Intento de edición hub sin lock válido (editor ${editorId})`,
    metadata: { editorId },
  });
}

export async function auditTokenReplay(ip: string, tokenHint: string): Promise<void> {
  await raiseSecurityAlert({
    type: "admin_token_replay",
    ip,
    detail: `Token de activación reutilizado (${tokenHint})`,
  });
}

export async function auditClientSideReport(input: {
  type: SecurityDetectionType;
  detail: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await raiseSecurityAlert({
    ...input,
    ip: "browser",
    username: "Navegador Admin",
  });
}
