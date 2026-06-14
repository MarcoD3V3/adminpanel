import { verifySessionToken } from "@/lib/launcher-auth/service";
import { parseClientKindFromRequest } from "@/lib/launcher-auth/client-kind";
import { clientIp, jsonWithCors, optionsResponse } from "@/lib/launcher-auth/http";

export async function OPTIONS(request: Request) {
  return optionsResponse(request.headers.get("origin"));
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const auth = request.headers.get("authorization");
  const deviceId = request.headers.get("x-device-id");
  const fingerprint = request.headers.get("x-device-fingerprint");

  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!token || !deviceId || !fingerprint) {
    return jsonWithCors({ valid: false, reason: "sin_credenciales" }, { status: 401 }, origin);
  }

  const result = await verifySessionToken(
    token,
    deviceId,
    fingerprint,
    clientIp(request),
    parseClientKindFromRequest(request)
  );
  if (!result.valid && result.reason === "rate") {
    return jsonWithCors({ valid: false, reason: "rate" }, { status: 429 }, origin);
  }
  return jsonWithCors(result, { status: result.valid ? 200 : 401 }, origin);
}
