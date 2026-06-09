import { appendAuditLog } from "./audit";
import {
  generateActivationToken,
  generateId,
  generateSessionToken,
  hashFingerprint,
  hashPassword,
  hashToken,
  isActivationTokenFormat,
  isSessionTokenFormat,
  isValidUsername,
  secureCompareToken,
  verifyPassword,
} from "./crypto";
import { checkRateLimit, resetRateLimit } from "./rate-limit";
import { getSkinMeta, skinExists } from "./skin-store";
import { mutateAuthStore, loadAuthStore } from "./store";
import { isValidDeviceId, isValidFingerprint, isValidRecordId, sanitizeIpHint } from "./validation";
import type {
  ActivationResult,
  ActivationTokenRecord,
  DeviceSessionRecord,
  GeneratedActivationToken,
  LauncherUserPublic,
  LauncherUserRecord,
  VerifySessionResult,
} from "./types";

const ACTIVATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const ACTIVATION_FAIL_MSG = "Activación rechazada. Comprueba el token o solicita uno nuevo.";
const LOGIN_FAIL_MSG = "Usuario o contraseña incorrectos.";

function nowIso(): string {
  return new Date().toISOString();
}

function isExpired(iso: string): boolean {
  return Date.parse(iso) < Date.now();
}

export async function createActivationToken(
  label?: string,
  ipHint?: string,
  tier: "free" | "premium" = "free"
): Promise<GeneratedActivationToken> {
  const store = await loadAuthStore();
  const seq = store.activationTokens.length + 1;
  const stamp = new Date().toISOString().slice(0, 10);
  const autoLabel = label?.trim() || `Token-${stamp}-${String(seq).padStart(3, "0")}`;
  const token = generateActivationToken();
  const id = generateId("atk");
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + ACTIVATION_TTL_MS).toISOString();

  await mutateAuthStore((store) => {
    store.activationTokens.push({
      id,
      label: autoLabel,
      tokenHash: hashToken(token),
      tier,
      createdAt,
      expiresAt,
      revoked: false,
    });
  });

  await appendAuditLog("token_created", ipHint, autoLabel);
  return { id, label: autoLabel, token, createdAt, expiresAt };
}

export async function listActivationTokens(): Promise<
  Omit<ActivationTokenRecord, "tokenHash">[]
> {
  const store = await loadAuthStore();
  return store.activationTokens.map(({ tokenHash: _h, ...rest }) => rest);
}

export async function listSessions(): Promise<Omit<DeviceSessionRecord, "tokenHash">[]> {
  const store = await loadAuthStore();
  return store.sessions.map(({ tokenHash: _h, ...rest }) => rest);
}

export async function listLauncherUsers(): Promise<LauncherUserPublic[]> {
  const store = await loadAuthStore();
  return store.users.map(({ passwordHash: _h, ...rest }) => rest);
}

export async function createLauncherUser(
  username: string,
  password: string,
  tier: "free" | "premium" = "free",
  displayName?: string,
  ipHint?: string
): Promise<LauncherUserPublic | { error: string }> {
  const normalized = username.trim().toLowerCase();
  if (!isValidUsername(normalized)) {
    return { error: "Usuario inválido (3–32 caracteres, letras/números/._-)" };
  }
  if (!password || password.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres" };
  }

  const store = await loadAuthStore();
  if (store.users.some((u) => u.username === normalized && !u.revoked)) {
    return { error: "Ese usuario ya existe" };
  }

  const id = generateId("usr");
  const createdAt = nowIso();
  const record: LauncherUserRecord = {
    id,
    username: normalized,
    displayName: displayName?.trim() || normalized,
    passwordHash: hashPassword(password),
    tier,
    createdAt,
    revoked: false,
  };

  await mutateAuthStore((s) => {
    s.users.push(record);
  });
  await appendAuditLog("user_created", ipHint, normalized);
  const { passwordHash: _h, ...pub } = record;
  return pub;
}

export async function revokeLauncherUser(id: string, ipHint?: string): Promise<boolean> {
  if (!isValidRecordId(id)) return false;
  let found = false;
  await mutateAuthStore((store) => {
    const user = store.users.find((x) => x.id === id);
    if (user) {
      user.revoked = true;
      found = true;
    }
  });
  if (found) await appendAuditLog("user_revoked", ipHint, id);
  return found;
}

export async function restoreLauncherUser(id: string, ipHint?: string): Promise<boolean> {
  if (!isValidRecordId(id)) return false;
  let found = false;
  await mutateAuthStore((store) => {
    const user = store.users.find((x) => x.id === id);
    if (user?.revoked) {
      user.revoked = false;
      found = true;
    }
  });
  if (found) await appendAuditLog("user_restored", ipHint, id);
  return found;
}

export async function revokeSessionsForUser(userId: string, ipHint?: string): Promise<number> {
  if (!isValidRecordId(userId)) return 0;
  let count = 0;
  await mutateAuthStore((store) => {
    for (const session of store.sessions) {
      if (session.userId === userId && !session.revoked) {
        session.revoked = true;
        count += 1;
      }
    }
  });
  if (count > 0) await appendAuditLog("sessions_revoked_bulk", ipHint, `${userId}:${count}`);
  return count;
}

export async function updateLauncherUser(
  id: string,
  patch: { displayName?: string; tier?: "free" | "premium" },
  ipHint?: string
): Promise<LauncherUserPublic | { error: string }> {
  if (!isValidRecordId(id)) return { error: "ID inválido" };

  let updated: LauncherUserRecord | null = null;
  await mutateAuthStore((store) => {
    const user = store.users.find((x) => x.id === id);
    if (!user || user.revoked) return;
    if (typeof patch.displayName === "string") user.displayName = patch.displayName.trim() || user.username;
    if (patch.tier === "premium" || patch.tier === "free") user.tier = patch.tier;
    updated = { ...user };
  });

  if (!updated) return { error: "Usuario no encontrado" };
  await appendAuditLog("user_updated", ipHint, id);
  const { passwordHash: _h, ...pub } = updated;
  return pub;
}

export async function resetLauncherUserPassword(
  id: string,
  newPassword: string,
  ipHint?: string
): Promise<{ success: boolean; error?: string }> {
  if (!isValidRecordId(id)) return { success: false, error: "ID inválido" };
  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: "La contraseña debe tener al menos 6 caracteres" };
  }

  let ok = false;
  await mutateAuthStore((store) => {
    const user = store.users.find((x) => x.id === id);
    if (!user || user.revoked) return;
    user.passwordHash = hashPassword(newPassword);
    ok = true;
  });

  if (!ok) return { success: false, error: "Usuario no encontrado" };
  await appendAuditLog("user_password_reset", ipHint, id);
  return { success: true };
}

async function createSessionForDevice(
  deviceId: string,
  fingerprint: string,
  ip: string | undefined,
  meta: { label?: string; tier?: "free" | "premium"; userId?: string; username?: string }
): Promise<ActivationResult> {
  const fpHash = hashFingerprint(`${deviceId}:${fingerprint}`);
  const sessionToken = generateSessionToken();
  const sessionId = generateId("ses");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const ts = nowIso();

  await mutateAuthStore((s) => {
    s.sessions.push({
      id: sessionId,
      tokenHash: hashToken(sessionToken),
      deviceId,
      deviceFingerprintHash: fpHash,
      label: meta.label,
      userId: meta.userId,
      username: meta.username,
      tier: meta.tier ?? "free",
      createdAt: ts,
      expiresAt,
      lastSeenAt: ts,
      revoked: false,
      ipHint: ip,
    });
  });

  return {
    sessionToken,
    sessionId,
    expiresAt,
    deviceId,
    tier: meta.tier ?? "free",
  };
}

export async function loginLauncherUser(
  username: string,
  password: string,
  deviceId: string,
  fingerprint: string,
  ipHint?: string
): Promise<ActivationResult | { error: string; status: number }> {
  const ip = sanitizeIpHint(ipHint);
  const rateKey = `login:${ip ?? "unknown"}:${deviceId}`;
  if (!checkRateLimit(rateKey, 8, 15 * 60 * 1000)) {
    return { error: "Demasiados intentos. Espera 15 minutos.", status: 429 };
  }

  if (!isValidDeviceId(deviceId) || !isValidFingerprint(fingerprint)) {
    await appendAuditLog("user_login_failed", ip, "invalid_device");
    return { error: LOGIN_FAIL_MSG, status: 401 };
  }

  const normalized = username.trim().toLowerCase();
  if (!isValidUsername(normalized) || !password) {
    await appendAuditLog("user_login_failed", ip, "invalid_format");
    return { error: LOGIN_FAIL_MSG, status: 401 };
  }

  const store = await loadAuthStore();
  const user = store.users.find((u) => u.username === normalized && !u.revoked);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    await appendAuditLog("user_login_failed", ip, normalized);
    return { error: LOGIN_FAIL_MSG, status: 401 };
  }

  const ts = nowIso();
  await mutateAuthStore((s) => {
    const live = s.users.find((x) => x.id === user.id);
    if (live) live.lastLoginAt = ts;
  });

  resetRateLimit(rateKey);
  await appendAuditLog("user_login_success", ip, user.username);
  return createSessionForDevice(deviceId, fingerprint, ip, {
    label: user.displayName ?? user.username,
    tier: user.tier ?? "free",
    userId: user.id,
    username: user.username,
  });
}

export async function revokeActivationToken(id: string, ipHint?: string): Promise<boolean> {
  if (!isValidRecordId(id)) return false;
  let found = false;
  await mutateAuthStore((store) => {
    const t = store.activationTokens.find((x) => x.id === id);
    if (t) {
      t.revoked = true;
      found = true;
    }
  });
  if (found) await appendAuditLog("token_revoked", ipHint, id);
  return found;
}

export async function revokeSession(id: string, ipHint?: string): Promise<boolean> {
  if (!isValidRecordId(id)) return false;
  let found = false;
  await mutateAuthStore((store) => {
    const s = store.sessions.find((x) => x.id === id);
    if (s) {
      s.revoked = true;
      found = true;
    }
  });
  if (found) await appendAuditLog("session_revoked", ipHint, id);
  return found;
}

export async function activateLauncherToken(
  rawToken: string,
  deviceId: string,
  fingerprint: string,
  ipHint?: string
): Promise<ActivationResult | { error: string; status: number }> {
  const ip = sanitizeIpHint(ipHint);
  const rateKey = `activate:${ip ?? "unknown"}:${deviceId}`;
  if (!checkRateLimit(rateKey, 5, 15 * 60 * 1000)) {
    return { error: ACTIVATION_FAIL_MSG, status: 429 };
  }

  if (!isValidDeviceId(deviceId) || !isValidFingerprint(fingerprint)) {
    await appendAuditLog("activation_failed", ip, "invalid_device");
    return { error: ACTIVATION_FAIL_MSG, status: 401 };
  }

  if (!isActivationTokenFormat(rawToken)) {
    await appendAuditLog("activation_failed", ip, "invalid_format");
    return { error: ACTIVATION_FAIL_MSG, status: 401 };
  }

  const store = await loadAuthStore();
  const record = store.activationTokens.find(
    (t) => !t.revoked && !t.usedAt && secureCompareToken(rawToken, t.tokenHash)
  );

  if (!record) {
    await appendAuditLog("activation_failed", ip, "not_found");
    return { error: ACTIVATION_FAIL_MSG, status: 401 };
  }

  if (isExpired(record.expiresAt)) {
    await appendAuditLog("activation_failed", ip, "expired");
    return { error: ACTIVATION_FAIL_MSG, status: 401 };
  }

  const activated = await createSessionForDevice(deviceId, fingerprint, ip, {
    label: record.label,
    tier: record.tier ?? "free",
  });

  const ts = nowIso();
  await mutateAuthStore((s) => {
    const t = s.activationTokens.find((x) => x.id === record.id);
    if (!t || t.usedAt) return;
    t.usedAt = ts;
    t.usedByDeviceId = deviceId;
  });

  resetRateLimit(rateKey);
  await appendAuditLog("activation_success", ip, activated.sessionId);
  return activated;
}

export async function verifySessionToken(
  rawToken: string,
  deviceId: string,
  fingerprint: string,
  ipHint?: string
): Promise<VerifySessionResult> {
  const ip = sanitizeIpHint(ipHint);
  const rateKey = `verify:${deviceId}:${ip ?? "unknown"}`;
  if (!checkRateLimit(rateKey, 120, 60 * 1000)) {
    return { valid: false, reason: "rate" };
  }

  if (!isValidDeviceId(deviceId) || !isValidFingerprint(fingerprint)) {
    return { valid: false, reason: "formato" };
  }

  if (!isSessionTokenFormat(rawToken)) {
    return { valid: false, reason: "formato" };
  }

  const fpHash = hashFingerprint(`${deviceId}:${fingerprint}`);
  const store = await loadAuthStore();
  const session = store.sessions.find(
    (s) => !s.revoked && secureCompareToken(rawToken, s.tokenHash)
  );

  if (!session) {
    await appendAuditLog("session_verify_failed", ip, "unknown");
    return { valid: false, reason: "desconocida" };
  }
  if (isExpired(session.expiresAt)) return { valid: false, reason: "expirada" };
  if (session.deviceId !== deviceId) {
    await appendAuditLog("session_verify_failed", ip, "device_mismatch");
    return { valid: false, reason: "dispositivo" };
  }
  if (session.deviceFingerprintHash !== fpHash) {
    await mutateAuthStore((s) => {
      const live = s.sessions.find((x) => x.id === session.id);
      if (live) live.deviceFingerprintHash = fpHash;
    });
  }

  await mutateAuthStore((s) => {
    const live = s.sessions.find((x) => x.id === session.id);
    if (live) live.lastSeenAt = nowIso();
  });

  let username = session.username;
  let displayName = session.label;
  if (session.userId) {
    const user = store.users.find((u) => u.id === session.userId && !u.revoked);
    if (user) {
      username = username ?? user.username;
      displayName = displayName ?? user.displayName ?? user.username;
    }
  }

  return {
    valid: true,
    sessionId: session.id,
    userId: session.userId,
    expiresAt: session.expiresAt,
    tier: session.tier ?? "free",
    premium: (session.tier ?? "free") === "premium",
    username,
    displayName,
  };
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim();
}

export async function verifyRequestSession(
  authHeader: string | null,
  deviceId: string | null,
  fingerprint: string | null
): Promise<VerifySessionResult> {
  const token = extractBearerToken(authHeader);
  if (!token || !deviceId || !fingerprint) {
    return { valid: false, reason: "sin_credenciales" };
  }
  return verifySessionToken(token, deviceId, fingerprint);
}

export type AdminProfileUser = LauncherUserPublic & {
  activeSessionCount: number;
  totalSessionCount: number;
  hasSkin: boolean;
  skinUpdatedAt?: string;
};

export type AdminSessionPublic = Omit<DeviceSessionRecord, "tokenHash" | "deviceFingerprintHash">;

export async function getAdminProfilesOverview(): Promise<{
  users: AdminProfileUser[];
  sessions: AdminSessionPublic[];
}> {
  const store = await loadAuthStore();
  const users: AdminProfileUser[] = store.users.map(({ passwordHash: _h, ...user }) => {
    const skinMeta = getSkinMeta(user.id);
    const userSessions = store.sessions.filter((s) => s.userId === user.id);
    return {
      ...user,
      activeSessionCount: userSessions.filter((s) => !s.revoked && !isExpired(s.expiresAt)).length,
      totalSessionCount: userSessions.length,
      hasSkin: skinExists(user.id),
      skinUpdatedAt: skinMeta?.updatedAt,
    };
  });

  const sessions: AdminSessionPublic[] = store.sessions.map(
    ({ tokenHash: _t, deviceFingerprintHash: _f, ...session }) => session
  );

  return { users, sessions };
}

export { listAuditLog } from "./audit";
export { isAdminSecretConfigured } from "./admin-session";

export function isLauncherAuthEnforced(): boolean {
  return process.env.LAUNCHER_AUTH_ENFORCE !== "false";
}
