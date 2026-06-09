import type { LauncherAuthHeaders } from "../types/launcher-auth";
import type { RemoteCommand } from "../types/protocol";

export type LiveOpsHeartbeatPayload = {
  status: "online" | "playing" | "launching" | "updating" | "idle";
  launcherVersion: string;
  minecraftVersion?: string;
  os: string;
  ramUsage: number;
  cpuUsage: number;
  timezone?: string;
  locale?: string;
};

export type LiveOpsHeartbeatResult = {
  ok: boolean;
  commands: RemoteCommand[];
  unauthorized?: boolean;
  error?: boolean;
};

export async function sendLiveOpsHeartbeat(
  apiBase: string,
  headers: LauncherAuthHeaders,
  payload: LiveOpsHeartbeatPayload
): Promise<LiveOpsHeartbeatResult> {
  try {
    const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/live-ops/presence`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: headers.authorization,
        "X-Device-Id": headers.deviceId,
        "X-Device-Fingerprint": headers.fingerprint,
      },
      body: JSON.stringify(payload),
    });
    if (res.status === 401) {
      return { ok: false, commands: [], unauthorized: true };
    }
    if (!res.ok) {
      return { ok: false, commands: [], error: true };
    }
    const data = (await res.json()) as { commands?: RemoteCommand[] };
    return { ok: true, commands: data.commands ?? [] };
  } catch {
    return { ok: false, commands: [], error: true };
  }
}
