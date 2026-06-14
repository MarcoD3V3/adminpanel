import {
  isLauncherAuthEnforced,
  verifyRequestSession,
} from "@/lib/launcher-auth/service";
import { clientIp, jsonWithCors, optionsResponse } from "@/lib/launcher-auth/http";
import { getUserRewardsState, processRewardsEvent, userRedeem } from "@/lib/rewards/service";

export async function OPTIONS(request: Request) {
  return optionsResponse(request.headers.get("origin"));
}

export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  const deviceId = request.headers.get("x-device-id")?.trim();

  if (!deviceId) {
    return jsonWithCors({ error: "deviceId requerido" }, { status: 400 }, origin);
  }

  let userId: string | undefined;
  let username = "usuario";

  if (isLauncherAuthEnforced()) {
    const session = await verifyRequestSession(
      request.headers.get("authorization"),
      deviceId,
      request.headers.get("x-device-fingerprint")
    );
    if (!session.valid || !session.userId) {
      return jsonWithCors({ error: "Sesión inválida" }, { status: 401 }, origin);
    }
    userId = session.userId;
    username = session.username ?? username;
  } else {
    userId = `dev_${deviceId}`;
  }

  const { ensureUser } = await import("@/lib/rewards/store");
  ensureUser(userId, username);
  const state = getUserRewardsState(userId);
  return jsonWithCors({ rewards: state }, { status: 200 }, origin);
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const deviceId = request.headers.get("x-device-id")?.trim();
  const ip = clientIp(request);

  if (!deviceId) {
    return jsonWithCors({ error: "deviceId requerido" }, { status: 400 }, origin);
  }

  const body = (await request.json()) as {
    scope?: string;
    metric?: string;
    amount?: number;
    redeemableId?: string;
    metadata?: Record<string, unknown>;
  };

  let userId: string | undefined;
  let username = "usuario";

  if (isLauncherAuthEnforced()) {
    const session = await verifyRequestSession(
      request.headers.get("authorization"),
      deviceId,
      request.headers.get("x-device-fingerprint")
    );
    if (!session.valid || !session.userId) {
      return jsonWithCors({ error: "Sesión inválida" }, { status: 401 }, origin);
    }
    userId = session.userId;
    username = session.username ?? username;
  } else {
    userId = `dev_${deviceId}`;
  }

  const rateKey = `rewards:${userId}:${ip ?? "unknown"}`;
  const { checkRateLimit } = await import("@/lib/launcher-auth/rate-limit");
  if (!checkRateLimit(rateKey, 60, 60_000)) {
    return jsonWithCors({ error: "Rate limit" }, { status: 429 }, origin);
  }

  if (body.scope === "redeem" && body.redeemableId) {
    const result = userRedeem(userId, username, body.redeemableId);
    return jsonWithCors(result, { status: result.ok ? 200 : 400 }, origin);
  }

  if (body.scope === "event" && body.metric) {
    const validMetrics = ["play_time", "login", "chat", "modpack_install", "event"] as const;
    if (!validMetrics.includes(body.metric as (typeof validMetrics)[number])) {
      return jsonWithCors({ error: "metric inválida" }, { status: 400 }, origin);
    }
    const amount = Math.min(Math.max(Number(body.amount ?? 1), 1), body.metric === "play_time" ? 5 : 10);
    const result = await processRewardsEvent(userId, username, {
      metric: body.metric as (typeof validMetrics)[number],
      amount,
      metadata: body.metadata,
    });
    return jsonWithCors({ success: true, ...result, rewards: getUserRewardsState(userId) }, { status: 200 }, origin);
  }

  return jsonWithCors({ error: "scope inválido" }, { status: 400 }, origin);
}
