import {
  isLauncherAuthEnforced,
  verifyRequestSession,
} from "@/lib/launcher-auth/service";
import { corsHeaders, jsonWithCors, optionsResponse } from "@/lib/launcher-auth/http";
import { pollNotificationsForDevice } from "@/lib/launcher-notifications/service";

export async function OPTIONS(request: Request) {
  return optionsResponse(request.headers.get("origin"));
}

export async function GET(request: Request) {
  const origin = request.headers.get("origin");

  if (isLauncherAuthEnforced()) {
    const session = await verifyRequestSession(
      request.headers.get("authorization"),
      request.headers.get("x-device-id"),
      request.headers.get("x-device-fingerprint")
    );
    if (!session.valid) {
      return jsonWithCors({ notifications: [] }, { status: 401 }, origin);
    }
  }

  const deviceId = request.headers.get("x-device-id")?.trim();
  if (!deviceId) {
    return jsonWithCors({ notifications: [] }, { status: 400 }, origin);
  }

  const notifications = await pollNotificationsForDevice(deviceId);
  const res = jsonWithCors({ notifications }, { status: 200 }, origin);
  return res;
}
