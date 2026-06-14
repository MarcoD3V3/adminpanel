import { activateLauncherToken } from "@/lib/launcher-auth/service";
import { loadAuthStore } from "@/lib/launcher-auth/store";
import {
  clientIp,
  jsonWithCors,
  optionsResponse,
  rejectActivationResponse,
} from "@/lib/launcher-auth/http";
import { auditTokenReplay } from "@/lib/security/guard";
import { secureCompareToken } from "@/lib/launcher-auth/crypto";

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

  const ip = clientIp(request);
  const token = body.token.trim();

  const result = await activateLauncherToken(
    token,
    body.deviceId.trim(),
    body.fingerprint.trim(),
    ip
  );

  if ("error" in result) {
    const store = await loadAuthStore();
    const replayed = store.activationTokens.find(
      (t) => t.usedAt && secureCompareToken(token, t.tokenHash)
    );
    if (replayed) {
      await auditTokenReplay(ip, `${replayed.label ?? "token"}@${token.slice(0, 6)}…`);
    }
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
      tester: result.tier === "tester",
      username: result.username,
      displayName: result.displayName,
    },
    { status: 200 },
    origin
  );
}
