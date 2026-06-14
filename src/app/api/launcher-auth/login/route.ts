import { loginLauncherUser } from "@/lib/launcher-auth/service";
import { loadAuthStore } from "@/lib/launcher-auth/store";
import {
  clientIp,
  jsonWithCors,
  optionsResponse,
  rejectActivationResponse,
} from "@/lib/launcher-auth/http";
import { auditAdminRequest, auditLauncherLoginFailed, auditLauncherRateLimit } from "@/lib/security/guard";

export async function OPTIONS(request: Request) {
  return optionsResponse(request.headers.get("origin"));
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  let body: { username?: string; password?: string; deviceId?: string; fingerprint?: string; portalLogin?: boolean };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return rejectActivationResponse(origin);
  }

  await auditAdminRequest(request, body);

  if (!body.username?.trim() || !body.password || !body.deviceId?.trim() || !body.fingerprint?.trim()) {
    return jsonWithCors({ success: false, error: "Datos incompletos" }, { status: 400 }, origin);
  }

  const ip = clientIp(request);
  const deviceId = body.deviceId.trim();

  const result = await loginLauncherUser(
    body.username,
    body.password,
    deviceId,
    body.fingerprint.trim(),
    ip,
    { forbidSingleUse: Boolean(body.portalLogin) }
  );

  if ("error" in result) {
    if (result.status === 429) {
      await auditLauncherRateLimit(ip, deviceId);
    } else {
      await auditLauncherLoginFailed(ip, deviceId, result.error);
    }
    return jsonWithCors({ success: false, error: result.error }, { status: result.status }, origin);
  }

  const store = await loadAuthStore();
  const session = store.sessions.find((s) => s.id === result.sessionId);

  return jsonWithCors(
    {
      success: true,
      sessionToken: result.sessionToken,
      sessionId: result.sessionId,
      expiresAt: result.expiresAt,
      deviceId: result.deviceId,
      tier: result.tier,
      premium: result.tier === "premium",
      username: session?.username ?? null,
    },
    { status: 200 },
    origin
  );
}
