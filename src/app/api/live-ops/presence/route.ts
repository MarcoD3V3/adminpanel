import {
  isLauncherAuthEnforced,
  verifyRequestSession,
} from "@/lib/launcher-auth/service";
import type { VerifySessionResult } from "@/lib/launcher-auth/types";
import { clientIp, corsHeaders, jsonWithCors, optionsResponse } from "@/lib/launcher-auth/http";
import { recordExperimentHeartbeat } from "@/lib/experiments/service";
import { loadExperimentStore } from "@/lib/experiments/store";
import { auditHeartbeatAnomaly } from "@/lib/security/guard";
import { pollCommandsForDevice, upsertPresence } from "@/lib/live-ops/service";
import { buildPresenceCommands, getPublicLauncherConfig } from "@/lib/settings/service";
import { loadSystemSettings } from "@/lib/settings/store";

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

  const storeBefore = await loadExperimentStore();
  const prevStatus = storeBefore.deviceStatus[deviceId];

  await upsertPresence({
    sessionId: session.sessionId!,
    userId: session.userId,
    username: session.username ?? "usuario",
    displayName: session.displayName,
    premium: session.premium ?? session.tier === "premium",
    tester: session.tester ?? session.tier === "tester",
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

  const ip = clientIp(request);
  await auditHeartbeatAnomaly(
    deviceId,
    ip,
    typeof body.ramUsage === "number" ? body.ramUsage : 0,
    typeof body.cpuUsage === "number" ? body.cpuUsage : 0,
    status
  );

  const launcherVersion = body.launcherVersion ?? "1.0.0";
  const settings = loadSystemSettings();

  const experiments = settings.features.experimentsEnabled
    ? await recordExperimentHeartbeat({
        deviceId,
        status,
        prevStatus,
      })
    : undefined;

  const { emitSystemEvent } = await import("@/lib/system-events");
  emitSystemEvent("launcher.online", {
    deviceId,
    userId: session.userId,
    username: session.username,
    launcherVersion,
    tier: session.tier,
    premium: session.premium,
  });

  const settingsCommands = await buildPresenceCommands(
    launcherVersion,
    session.tester ?? session.tier === "tester"
  );
  const polled = await pollCommandsForDevice(deviceId);
  const config = await getPublicLauncherConfig();
  let rewards = null;
  if (session.userId) {
    const { ensureUser } = await import("@/lib/rewards/store");
    const { getUserRewardsState } = await import("@/lib/rewards/service");
    ensureUser(session.userId, session.username ?? "usuario");
    rewards = getUserRewardsState(session.userId);

    if (status === "playing" || status === "launching") {
      const { processRewardsEvent } = await import("@/lib/rewards/service");
      void processRewardsEvent(session.userId, session.username ?? "usuario", {
        metric: "play_time",
        amount: 1,
      });
    }
  }

  return jsonWithCors(
    { ok: true, commands: [...settingsCommands, ...polled], experiments, config, rewards },
    { status: 200 },
    origin
  );
}
