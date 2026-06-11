import type { LauncherTier } from "../constants/launcher-tiers";

export type { LauncherTier };

export type ActivationTokenPublic = {
  id: string;
  label: string;
  tier?: LauncherTier;
  minecraftUsername?: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
  usedByDeviceId?: string;
  revoked: boolean;
};

export type DeviceSessionPublic = {
  id: string;
  deviceId: string;
  label?: string;
  username?: string;
  tier?: LauncherTier;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
  revoked: boolean;
  ipHint?: string;
};

export type ActivateResponse = {
  success: boolean;
  sessionToken?: string;
  sessionId?: string;
  expiresAt?: string;
  deviceId?: string;
  tier?: LauncherTier;
  premium?: boolean;
  tester?: boolean;
  username?: string;
  displayName?: string;
  error?: string;
};

export type VerifyResponse = {
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
};

export type PlayerSkinInfo = {
  hasSkin: boolean;
  updatedAt?: string | null;
  username?: string | null;
  dataUrl?: string;
  requiresAccount?: boolean;
  error?: string;
};

export type PlayerSkinRegistryEntry = {
  userId: string;
  username: string;
  updatedAt: string;
};

export type PlayerSkinUploadResponse = {
  success: boolean;
  updatedAt?: string;
  username?: string;
  error?: string;
};

export type LoginResponse = ActivateResponse & {
  username?: string | null;
};

export type LauncherAuthHeaders = {
  authorization: string;
  deviceId: string;
  fingerprint: string;
};

export type GeneratedTokenResponse = {
  success: boolean;
  message?: string;
  token?: {
    id: string;
    label: string;
    token: string;
    expiresAt: string;
    createdAt: string;
  };
  error?: string;
};
