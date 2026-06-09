import {
  createActivationToken,
  listActivationTokens,
  listAuditLog,
  listSessions,
  revokeActivationToken,
  revokeSession,
} from "@/lib/launcher-auth/service";
import { isAdminSecretConfigured, usesDevAdminFallback } from "@/lib/launcher-auth/admin-session";
import {
  assertAdminSession,
  clientIp,
  isSameOriginAdminRequest,
  jsonSecure,
} from "@/lib/launcher-auth/http";

export async function GET() {
  const authenticated = await assertAdminSession();
  const [tokens, sessions, auditLog] = authenticated
    ? await Promise.all([listActivationTokens(), listSessions(), listAuditLog(40)])
    : [[], [], []];

  return jsonSecure({
    authenticated,
    configured: isAdminSecretConfigured(),
    devFallbackActive: !authenticated && usesDevAdminFallback(),
    tokens,
    sessions,
    auditLog,
  });
}

export async function POST(request: Request) {
  if (!isSameOriginAdminRequest(request)) {
    return jsonSecure({ error: "Origen no permitido" }, { status: 403 });
  }
  if (!(await assertAdminSession())) {
    return jsonSecure({ error: "Sesión admin requerida" }, { status: 401 });
  }

  const ip = clientIp(request);
  const body = (await request.json()) as { action?: string; id?: string; label?: string; tier?: string };

  if (body.action === "revoke-token" && body.id) {
    const ok = await revokeActivationToken(body.id, ip);
    return jsonSecure({ success: ok }, { status: ok ? 200 : 404 });
  }

  if (body.action === "revoke-session" && body.id) {
    const ok = await revokeSession(body.id, ip);
    return jsonSecure({ success: ok }, { status: ok ? 200 : 404 });
  }

  const tier = body.tier === "premium" ? "premium" : "free";
  const created = await createActivationToken(body.label, ip, tier);
  return jsonSecure(
    {
      success: true,
      message: "Copia el token ahora. No se volverá a mostrar.",
      token: created,
    },
    { status: 201 }
  );
}
