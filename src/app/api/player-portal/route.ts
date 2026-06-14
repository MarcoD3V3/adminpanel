import { verifyRequestSession } from "@/lib/launcher-auth/service";
import { jsonWithCors, optionsResponse } from "@/lib/launcher-auth/http";
import { buildPlayerPortal } from "@/lib/player-portal/service";

export async function OPTIONS(request: Request) {
  return optionsResponse(request.headers.get("origin"));
}

export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  const deviceId = request.headers.get("x-device-id")?.trim();

  if (!deviceId) {
    return jsonWithCors({ error: "deviceId requerido" }, { status: 400 }, origin);
  }

  const session = await verifyRequestSession(
    request.headers.get("authorization"),
    deviceId,
    request.headers.get("x-device-fingerprint"),
    "portal"
  );

  if (!session.valid) {
    return jsonWithCors({ error: "Sesión inválida", reason: session.reason }, { status: 401 }, origin);
  }

  const portal = await buildPlayerPortal(session, deviceId);
  if (!portal) {
    return jsonWithCors({ error: "Jugador no encontrado" }, { status: 404 }, origin);
  }

  return jsonWithCors({ portal }, { status: 200 }, origin);
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const deviceId = request.headers.get("x-device-id")?.trim() ?? null;
  const session = await verifyRequestSession(
    request.headers.get("authorization"),
    deviceId,
    request.headers.get("x-device-fingerprint"),
    "portal"
  );

  if (!session.valid || !session.userId) {
    return jsonWithCors({ error: "Sesión inválida" }, { status: 401 }, origin);
  }

  const body = (await request.json()) as {
    action?: string;
    redeemableId?: string;
    key?: string;
    value?: boolean;
  };
  const username = session.username ?? "usuario";

  if (body.action === "redeem" && body.redeemableId) {
    const { userRedeem } = await import("@/lib/rewards/service");
    const result = userRedeem(session.userId, username, body.redeemableId);
    const portal = deviceId ? await buildPlayerPortal(session, deviceId) : null;
    return jsonWithCors({ ...result, portal }, { status: result.ok ? 200 : 400 }, origin);
  }

  if (body.action === "set_preference" && typeof body.key === "string" && typeof body.value === "boolean") {
    const { setPlayerPortalPreference } = await import("@/lib/player-portal/prefs");
    const result = setPlayerPortalPreference(session.userId, body.key, body.value);
    if (!result.ok) {
      return jsonWithCors({ error: result.error }, { status: 400 }, origin);
    }
    const portal = deviceId ? await buildPlayerPortal(session, deviceId) : null;
    return jsonWithCors({ ok: true, preferences: result.preferences, portal }, { status: 200 }, origin);
  }

  return jsonWithCors({ error: "Acción inválida" }, { status: 400 }, origin);
}
