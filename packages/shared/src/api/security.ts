import type { LauncherAuthHeaders } from "../types/launcher-auth";

export type SecurityReportType =
  | "launcher_cheat_client"
  | "launcher_modified_jar"
  | "launcher_hwid_mismatch"
  | "launcher_suspicious_mod"
  | "launcher_code_injection"
  | "launcher_debugger_attached"
  | "launcher_ssl_pin_bypass"
  | "launcher_token_theft"
  | "launcher_heartbeat_anomaly"
  | "launcher_file_tamper"
  | "launcher_env_tamper"
  | "launcher_proxy_mitm"
  | "launcher_bot_automation"
  | "launcher_unsigned_binary"
  | "launcher_login_brute";

export async function reportLauncherSecurity(
  apiBase: string,
  auth: LauncherAuthHeaders,
  payload: {
    type: SecurityReportType;
    detail: string;
    clientName?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await fetch(`${apiBase.replace(/\/$/, "")}/api/security/report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth.authorization,
        "X-Device-Id": auth.deviceId,
        "X-Device-Fingerprint": auth.fingerprint,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    /* ignore */
  }
}
