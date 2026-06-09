import { activateLauncherToken } from "@/lib/launcher-auth/service";
import {
  clientIp,
  jsonWithCors,
  optionsResponse,
  rejectActivationResponse,
} from "@/lib/launcher-auth/http";

export async function OPTIONS(request: Request) {
  return optionsResponse(request.headers.get("origin"));
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  let body: { token?: string; deviceId?: string; fingerprint?: string };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return rejectActivationResponse(origin);
  }

  if (!body.token?.trim() || !body.deviceId?.trim() || !body.fingerprint?.trim()) {
    return rejectActivationResponse(origin);
  }

  const result = await activateLauncherToken(
    body.token.trim(),
    body.deviceId.trim(),
    body.fingerprint.trim(),
    clientIp(request)
  );

  if ("error" in result) {
    return jsonWithCors({ success: false, error: result.error }, { status: result.status }, origin);
  }

  return jsonWithCors(
    {
      success: true,
      sessionToken: result.sessionToken,
      sessionId: result.sessionId,
      expiresAt: result.expiresAt,
      deviceId: result.deviceId,
      tier: result.tier,
      premium: result.tier === "premium",
    },
    { status: 200 },
    origin
  );
}
