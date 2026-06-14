import { NextResponse } from "next/server";
import {
  isLauncherAuthEnforced,
  verifyRequestSession,
} from "@/lib/launcher-auth/service";
import { clientIp, corsHeaders, jsonWithCors, optionsResponse } from "@/lib/launcher-auth/http";
import { auditLauncherReport } from "@/lib/security/guard";
import type { SecurityDetectionType } from "@/types/features";
import { DETECTION_BY_TYPE } from "@/lib/security/catalog";

export async function OPTIONS(request: Request) {
  return optionsResponse(request.headers.get("origin"));
}

const LAUNCHER_TYPES = new Set(
  Object.keys(DETECTION_BY_TYPE).filter((k) => k.startsWith("launcher_"))
);

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const deviceId = request.headers.get("x-device-id")?.trim();
  const ip = clientIp(request);

  let username = "Launcher";
  let userId = "";

  if (isLauncherAuthEnforced()) {
    if (!deviceId) {
      return jsonWithCors({ error: "deviceId requerido" }, { status: 400 }, origin);
    }
    const session = await verifyRequestSession(
      request.headers.get("authorization"),
      deviceId,
      request.headers.get("x-device-fingerprint")
    );
    if (!session.valid) {
      return jsonWithCors({ error: "Sesión inválida" }, { status: 401 }, origin);
    }
    username = session.username ?? username;
    userId = session.userId ?? "";
  }

  const body = (await request.json()) as {
    type?: SecurityDetectionType;
    detail?: string;
    clientName?: string;
    metadata?: Record<string, unknown>;
  };

  if (!body.type || !LAUNCHER_TYPES.has(body.type) || !body.detail?.trim()) {
    return jsonWithCors({ error: "type y detail requeridos" }, { status: 400 }, origin);
  }

  await auditLauncherReport({
    type: body.type,
    detail: body.detail.trim(),
    deviceId,
    username,
    userId,
    ip,
    clientName: body.clientName,
    metadata: body.metadata,
  });

  return jsonWithCors({ success: true }, { status: 200 }, origin);
}
