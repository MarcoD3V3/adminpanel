import type { LauncherTier, ProfilePlanId } from "@craftlauncher/shared";

export type { LauncherTier };

export type ActivationTokenRecord = {
  id: string;
  label: string;
  tokenHash: string;
  /** free | premium | tester (nombre MC fijo en el token) */
  tier?: LauncherTier;
  minecraftUsername?: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
  usedByDeviceId?: string;
  revoked: boolean;
};

/** Dónde se creó o se usó por última vez la sesión. */
export type SessionClientKind = "launcher" | "portal" | "tester";

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
  /** Plataforma del primer inicio de sesión. */
  clientKind?: SessionClientKind;
  /** Última plataforma que renovó la sesión (verify / portal). */
  lastClientKind?: SessionClientKind;
};

export type LauncherUserRecord = {
  id: string;
  username: string;
  displayName?: string;
  passwordHash: string;
  /** Contraseña cifrada para acceso_portal en portapapeles (solo user_web descifra) */
  portalAccessSealed?: string;
  tier: ProfilePlanId;
  email?: string;
  notes?: string;
  referralCode?: string;
  createdAt: string;
  revoked: boolean;
  lastLoginAt?: string;
  /** Si está definido, la cuenta se elimina automáticamente al expirar */
  temporaryExpiresAt?: string;
  /** Se elimina tras el primer inicio de sesión exitoso */
  singleUse?: boolean;
};

export type LauncherAuthStore = {
  activationTokens: ActivationTokenRecord[];
  sessions: DeviceSessionRecord[];
  users: LauncherUserRecord[];
  auditLog?: AuditLogEntry[];
  /** Si true, el launcher muestra modo testeo y acepta tokens tester. */
  testerModeEnabled?: boolean;
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
    | "user_deleted"
    | "user_restored"
    | "user_updated"
    | "user_password_reset"
    | "sessions_revoked_bulk"
    | "skin_uploaded_admin"
    | "skin_deleted_admin"
    | "user_login_success"
    | "user_login_failed"
    | "tester_mode_enabled"
    | "tester_mode_disabled";
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
  username?: string;
  displayName?: string;
};

export type VerifySessionResult = {
  valid: boolean;
  sessionId?: string;
  userId?: string;
  expiresAt?: string;
  tier?: LauncherTier;
  premium?: boolean;
  tester?: boolean;
  username?: string;
  displayName?: string;
  reason?: string;
  /** false si la sesión es válida pero el usuario fue borrado o revocado (portal no disponible). */
  accountAvailable?: boolean;
};

export type LauncherUserPublic = Omit<LauncherUserRecord, "passwordHash" | "portalAccessSealed">;
