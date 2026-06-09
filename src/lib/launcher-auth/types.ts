export type LauncherTier = "free" | "premium";

export type ActivationTokenRecord = {
  id: string;
  label: string;
  tokenHash: string;
  /** free = mods CurseForge + jugar; premium = modpacks destacados premium */
  tier?: LauncherTier;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
  usedByDeviceId?: string;
  revoked: boolean;
};

export type DeviceSessionRecord = {
  id: string;
  tokenHash: string;
  deviceId: string;
  deviceFingerprintHash: string;
  label?: string;
  userId?: string;
  username?: string;
  tier?: LauncherTier;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
  revoked: boolean;
  ipHint?: string;
};

export type LauncherUserRecord = {
  id: string;
  username: string;
  displayName?: string;
  passwordHash: string;
  tier: LauncherTier;
  createdAt: string;
  revoked: boolean;
  lastLoginAt?: string;
};

export type LauncherAuthStore = {
  activationTokens: ActivationTokenRecord[];
  sessions: DeviceSessionRecord[];
  users: LauncherUserRecord[];
  auditLog?: AuditLogEntry[];
};

export type AuditLogEntry = {
  id: string;
  action:
    | "admin_login"
    | "admin_login_failed"
    | "token_created"
    | "token_revoked"
    | "session_revoked"
    | "activation_success"
    | "activation_failed"
    | "session_verify_failed"
    | "user_created"
    | "user_revoked"
    | "user_restored"
    | "user_updated"
    | "user_password_reset"
    | "sessions_revoked_bulk"
    | "skin_uploaded_admin"
    | "skin_deleted_admin"
    | "user_login_success"
    | "user_login_failed";
  at: string;
  ipHint?: string;
  meta?: string;
};

export type GeneratedActivationToken = {
  id: string;
  label: string;
  token: string;
  expiresAt: string;
  createdAt: string;
};

export type ActivationResult = {
  sessionToken: string;
  sessionId: string;
  expiresAt: string;
  deviceId: string;
  tier: LauncherTier;
};

export type VerifySessionResult = {
  valid: boolean;
  sessionId?: string;
  userId?: string;
  expiresAt?: string;
  tier?: LauncherTier;
  premium?: boolean;
  username?: string;
  displayName?: string;
  reason?: string;
};

export type LauncherUserPublic = Omit<LauncherUserRecord, "passwordHash">;
