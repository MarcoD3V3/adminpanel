import {
  isLauncherAuthEnforced,
  verifyRequestSession,
} from "@/lib/launcher-auth/service";
import type { VerifySessionResult } from "@/lib/launcher-auth/types";
import { clientIp, corsHeaders, jsonWithCors, optionsResponse } from "@/lib/launcher-auth/http";
import { pollCommandsForDevice, upsertPresence } from "@/lib/live-ops/service";

export async function OPTIONS(request: Request) {
  return optionsResponse(request.headers.get("origin"));
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const deviceId = request.headers.get("x-device-id")?.trim();

  if (!deviceId) {
    return jsonWithCors({ error: "deviceId requerido" }, { status: 400 }, origin);
  }

  let session: VerifySessionResult = { valid: false };
  if (isLauncherAuthEnforced()) {
    session = await verifyRequestSession(
      request.headers.get("authorization"),
      deviceId,
      request.headers.get("x-device-fingerprint")
    );
    if (!session.valid) {
      return jsonWithCors({ error: "Sesión inválida" }, { status: 401 }, origin);
    }
  } else {
    session = {
      valid: true,
      sessionId: `dev_${deviceId}`,
      username: "dev",
      displayName: "Dev",
      tier: "free",
      premium: false,
    };
  }

  const body = (await request.json()) as {
    status?: string;
    launcherVersion?: string;
    minecraftVersion?: string;
    os?: string;
    ramUsage?: number;
    cpuUsage?: number;
    timezone?: string;
    locale?: string;
  };

  const status = (
    ["online", "playing", "launching", "updating", "idle"].includes(body.status ?? "")
      ? body.status
      : "online"
  ) as "online" | "playing" | "launching" | "updating" | "idle";

  await upsertPresence({
    sessionId: session.sessionId!,
    userId: session.userId,
    username: session.username ?? "usuario",
    displayName: session.displayName,
    premium: session.premium ?? session.tier === "premium",
    deviceId,
    status,
    launcherVersion: body.launcherVersion ?? "1.0.0",
    minecraftVersion: body.minecraftVersion,
    os: body.os ?? "Unknown",
    ramUsage: typeof body.ramUsage === "number" ? body.ramUsage : 0,
    cpuUsage: typeof body.cpuUsage === "number" ? body.cpuUsage : 0,
    timezone: body.timezone,
    locale: body.locale,
    ip: clientIp(request) ?? undefined,
  });

  const commands = await pollCommandsForDevice(deviceId);
  return jsonWithCors({ ok: true, commands }, { status: 200 }, origin);
}
