import {
  isLauncherAuthEnforced,
  verifyRequestSession,
} from "@/lib/launcher-auth/service";
import { jsonWithCors, optionsResponse } from "@/lib/launcher-auth/http";
import { ackNotifications } from "@/lib/launcher-notifications/service";

export async function OPTIONS(request: Request) {
  return optionsResponse(request.headers.get("origin"));
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");

  if (isLauncherAuthEnforced()) {
    const session = await verifyRequestSession(
      request.headers.get("authorization"),
      request.headers.get("x-device-id"),
      request.headers.get("x-device-fingerprint")
    );
    if (!session.valid) {
      return jsonWithCors({ success: false }, { status: 401 }, origin);
    }
  }

  const deviceId = request.headers.get("x-device-id")?.trim();
  if (!deviceId) {
    return jsonWithCors({ success: false }, { status: 400 }, origin);
  }

  const body = (await request.json()) as { ids?: string[] };
  const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === "string") : [];
  const acked = await ackNotifications(deviceId, ids);

  return jsonWithCors({ success: true, acked }, { status: 200 }, origin);
}
