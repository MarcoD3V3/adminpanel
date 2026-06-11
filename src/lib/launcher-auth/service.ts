import {
  isPremiumPlan,
  isTesterTier,
  normalizeLauncherTier,
  normalizeMinecraftUsername,
  normalizeProfilePlan,
  resolveSessionDisplayName,
  usernameFromCuentaLabel,
  type LauncherTier,
} from "@craftlauncher/shared";
import { validatePassword } from "@/lib/password-policy";
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
import { deleteUserSkin, getSkinMeta, skinExists } from "./skin-store";
import { isTesterModeEnabled } from "./access-settings";
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
const TESTER_DISABLED_MSG =
  "El modo testeo está desactivado. Inicia sesión con tu cuenta o pide al admin que lo active.";
const LOGIN_FAIL_MSG = "Usuario o contraseña incorrectos.";

function nowIso(): string {
  return new Date().toISOString();
}

function resolveSessionTier(raw?: string | null): LauncherTier {
  if (isTesterTier(raw)) return "tester";
  if (isPremiumPlan(raw ?? "")) return "premium";
  return normalizeLauncherTier(raw);
}

function isExpired(iso: string): boolean {
  return Date.parse(iso) < Date.now();
}

export async function createActivationToken(
  label?: string,
  ipHint?: string,
  tier: LauncherTier = "free",
  minecraftUsername?: string
): Promise<GeneratedActivationToken | { error: string }> {
  const normalizedTier = normalizeLauncherTier(tier);
  let mcName: string | undefined;

  if (isTesterTier(normalizedTier)) {
    if (!(await isTesterModeEnabled())) {
      return { error: "El modo testeo está desactivado. Actívalo en Admin → Acceso Launcher." };
    }
    const resolved = normalizeMinecraftUsername(minecraftUsername ?? "");
    if (!resolved) {
      return {
        error: "Nombre de Minecraft inválido (3–16 caracteres: letras, números y _)",
      };
    }
    mcName = resolved;
  }

  const store = await loadAuthStore();
  const seq = store.activationTokens.length + 1;
  const stamp = new Date().toISOString().slice(0, 10);
  const autoLabel = isTesterTier(normalizedTier)
    ? `Tester: ${mcName}`
    : label?.trim() || `Token-${stamp}-${String(seq).padStart(3, "0")}`;
  const token = generateActivationToken();
  const id = generateId("atk");
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + ACTIVATION_TTL_MS).toISOString();

  await mutateAuthStore((store) => {
    store.activationTokens.push({
      id,
      label: autoLabel,
      tokenHash: hashToken(token),
      tier: normalizedTier,
      minecraftUsername: mcName,
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
  tier: string = "free",
  displayName?: string,
  ipHint?: string,
  extras?: { email?: string; notes?: string; referralCode?: string }
): Promise<LauncherUserPublic | { error: string }> {
  const normalized = username.trim().toLowerCase();
  if (!isValidUsername(normalized)) {
    return { error: "Usuario inválido (3–32 caracteres, letras/números/._-)" };
  }
  const passwordCheck = validatePassword(password, { username: normalized, displayName });
  if (!passwordCheck.valid) {
    return { error: passwordCheck.errors[0] ?? "Contraseña demasiado débil" };
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
    tier: normalizeProfilePlan(tier),
    email: extras?.email?.trim() || undefined,
    notes: extras?.notes?.trim() || undefined,
    referralCode: extras?.referralCode?.trim() || undefined,
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

export async function deleteLauncherUser(
  id: string,
  ipHint?: string
): Promise<{ success: boolean; error?: string }> {
  if (!isValidRecordId(id)) {
    return { success: false, error: "ID de perfil inválido" };
  }

  let username: string | undefined;
  let removed = false;
  await mutateAuthStore((s) => {
    const index = s.users.findIndex((x) => x.id === id);
    if (index === -1) return;
    username = s.users[index]!.username;
    s.users.splice(index, 1);
    s.sessions = s.sessions.filter((session) => session.userId !== id);
    removed = true;
  });

  if (!removed) {
    return { success: true };
  }

  try {
    await deleteUserSkin(id);
  } catch {
    // El perfil ya se eliminó del store; la skin es limpieza secundaria.
  }
  await appendAuditLog("user_deleted", ipHint, `${username}:${id}`);
  return { success: true };
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
  patch: { displayName?: string; tier?: string; email?: string; notes?: string; referralCode?: string },
  ipHint?: string
): Promise<LauncherUserPublic | { error: string }> {
  if (!isValidRecordId(id)) return { error: "ID inválido" };

  let updated: LauncherUserRecord | null = null;
  await mutateAuthStore((store) => {
    const user = store.users.find((x) => x.id === id);
    if (!user || user.revoked) return;
    if (typeof patch.displayName === "string") user.displayName = patch.displayName.trim() || user.username;
    if (typeof patch.tier === "string") user.tier = normalizeProfilePlan(patch.tier);
    if (typeof patch.email === "string") user.email = patch.email.trim() || undefined;
    if (typeof patch.notes === "string") user.notes = patch.notes.trim() || undefined;
    if (typeof patch.referralCode === "string") {
      user.referralCode = patch.referralCode.trim() || undefined;
    }
    updated = { ...user };
  });

  if (!updated) return { error: "Usuario no encontrado" };
  await appendAuditLog("user_updated", ipHint, id);
  const record: LauncherUserRecord = updated;
  const { passwordHash: _h, ...pub } = record;
  return pub;
}

export async function resetLauncherUserPassword(
  id: string,
  newPassword: string,
  ipHint?: string
): Promise<{ success: boolean; error?: string }> {
  if (!isValidRecordId(id)) return { success: false, error: "ID inválido" };

  const store = await loadAuthStore();
  const user = store.users.find((x) => x.id === id);
  if (!user || user.revoked) return { success: false, error: "Usuario no encontrado" };

  const passwordCheck = validatePassword(newPassword, {
    username: user.username,
    displayName: user.displayName,
  });
  if (!passwordCheck.valid) {
    return { success: false, error: passwordCheck.errors[0] ?? "Contraseña demasiado débil" };
  }

  let ok = false;
  await mutateAuthStore((s) => {
    const target = s.users.find((x) => x.id === id);
    if (!target || target.revoked) return;
    target.passwordHash = hashPassword(newPassword);
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
  meta: { label?: string; tier?: string; userId?: string; username?: string }
): Promise<ActivationResult> {
  const fpHash = hashFingerprint(`${deviceId}:${fingerprint}`);
  const sessionToken = generateSessionToken();
  const sessionId = generateId("ses");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const ts = nowIso();
  const tier = resolveSessionTier(meta.tier);

  await mutateAuthStore((s) => {
    s.sessions.push({
      id: sessionId,
      tokenHash: hashToken(sessionToken),
      deviceId,
      deviceFingerprintHash: fpHash,
      label: meta.label,
      userId: meta.userId,
      username: meta.username,
      tier,
      createdAt: ts,
      expiresAt,
      lastSeenAt: ts,
      revoked: false,
      ipHint: ip,
    });
  });
  const username = meta.username?.trim() || undefined;
  return {
    sessionToken,
    sessionId,
    expiresAt,
    deviceId,
    tier,
    username,
    displayName: resolveSessionDisplayName(meta.label, username),
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

  const tier = normalizeLauncherTier(record.tier);
  if (isTesterTier(tier) && !(await isTesterModeEnabled())) {
    await appendAuditLog("activation_failed", ip, "tester_disabled");
    return { error: TESTER_DISABLED_MSG, status: 403 };
  }
  const mcName = isTesterTier(tier)
    ? normalizeMinecraftUsername(record.minecraftUsername ?? "")
    : null;
  if (isTesterTier(tier) && !mcName) {
    await appendAuditLog("activation_failed", ip, "tester_invalid");
    return { error: ACTIVATION_FAIL_MSG, status: 401 };
  }

  const inferredUsername = !mcName ? usernameFromCuentaLabel(record.label) : undefined;
  const activated = await createSessionForDevice(deviceId, fingerprint, ip, {
    label: mcName ?? record.label,
    tier,
    username: mcName ?? inferredUsername,
  });

  const ts = nowIso();
  await mutateAuthStore((s) => {
    const t = s.activationTokens.find((x) => x.id === record.id);
    if (!t || t.usedAt) return;
    t.usedAt = ts;
    t.usedByDeviceId = deviceId;
  });

  resetRateLimit(rateKey);
  await appendAuditLog(
    "activation_success",
    ip,
    isTesterTier(tier) ? `tester:${mcName}:${activated.sessionId}` : activated.sessionId
  );
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
  let displayName: string | undefined;
  if (session.userId) {
    const user = store.users.find((u) => u.id === session.userId && !u.revoked);
    if (user) {
      username = username ?? user.username;
      displayName = resolveSessionDisplayName(user.displayName ?? user.username, user.username);
    }
  }
  if (!displayName) {
    displayName = resolveSessionDisplayName(session.label, username);
  }

  const tier = normalizeLauncherTier(session.tier);
  return {
    valid: true,
    sessionId: session.id,
    userId: session.userId,
    expiresAt: session.expiresAt,
    tier,
    premium: tier === "premium",
    tester: isTesterTier(tier),
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

export type AdminSessionPublic = Omit<DeviceSessionRecord, "tokenHash" | "deviceFingerprintHash"> & {
  fingerprintPrefix?: string;
};

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
    ({ tokenHash: _t, deviceFingerprintHash, ...session }) => ({
      ...session,
      fingerprintPrefix: deviceFingerprintHash.slice(0, 12),
    })
  );

  return { users, sessions };
}

export { listAuditLog } from "./audit";
export { isAdminSecretConfigured } from "./admin-session";

export function isLauncherAuthEnforced(): boolean {
  return process.env.LAUNCHER_AUTH_ENFORCE !== "false";
}
