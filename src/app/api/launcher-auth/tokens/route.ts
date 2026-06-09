import {
  createActivationToken,
  listActivationTokens,
  listSessions,
  revokeActivationToken,
  revokeSession,
} from "@/lib/launcher-auth/service";
import {
  assertAdminAccess,
  clientIp,
  jsonSecure,
  jsonWithCors,
  optionsResponse,
} from "@/lib/launcher-auth/http";

export async function OPTIONS(request: Request) {
  return optionsResponse(request.headers.get("origin"));
}

export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  if (!(await assertAdminAccess(request))) {
    return jsonWithCors({ error: "No autorizado" }, { status: 401 }, origin);
  }

  const [tokens, sessions] = await Promise.all([listActivationTokens(), listSessions()]);
  return jsonWithCors({ tokens, sessions }, { status: 200 }, origin);
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const body = (await request.json()) as { label?: string; action?: string; id?: string; tier?: string };

  if (!(await assertAdminAccess(request))) {
    return jsonWithCors({ error: "No autorizado" }, { status: 401 }, origin);
  }

  const ip = clientIp(request);

  if (body.action === "revoke-token" && body.id) {
    const ok = await revokeActivationToken(body.id, ip);
    return jsonWithCors({ success: ok }, { status: ok ? 200 : 404 }, origin);
  }

  if (body.action === "revoke-session" && body.id) {
    const ok = await revokeSession(body.id, ip);
    return jsonWithCors({ success: ok }, { status: ok ? 200 : 404 }, origin);
  }

  const tier = body.tier === "premium" ? "premium" : "free";
  const created = await createActivationToken(body.label, ip, tier);
  return jsonWithCors(
    {
      success: true,
      message: "Copia el token ahora. No se volverá a mostrar.",
      token: created,
    },
    { status: 201 },
    origin
  );
}
