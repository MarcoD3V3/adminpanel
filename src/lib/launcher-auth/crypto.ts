import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const ACTIVATION_PREFIX = "clakt_";
const SESSION_PREFIX = "clses_";
const MAX_TOKEN_LEN = 128;

function pepper(): string {
  const value = process.env.LAUNCHER_TOKEN_PEPPER;
  if (!value || value.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("LAUNCHER_TOKEN_PEPPER must be set in production");
    }
    return "dev-pepper-change-in-production-min16";
  }
  return value;
}

export function secureCompareSecret(input: string | null, secret: string | null): boolean {
  if (!input || !secret) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(`${pepper()}:${raw}`).digest("hex");
}

export function secureCompareToken(raw: string, storedHash: string): boolean {
  const a = Buffer.from(hashToken(raw));
  const b = Buffer.from(storedHash);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function generateActivationToken(): string {
  return `${ACTIVATION_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function generateSessionToken(): string {
  return `${SESSION_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function generateId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

export function hashFingerprint(input: string): string {
  return createHash("sha256").update(`${pepper()}:fp:${input}`).digest("hex");
}

export function isActivationTokenFormat(token: string): boolean {
  return (
    token.startsWith(ACTIVATION_PREFIX) &&
    token.length >= 40 &&
    token.length <= MAX_TOKEN_LEN &&
    /^[a-zA-Z0-9_-]+$/.test(token)
  );
}

export function isSessionTokenFormat(token: string): boolean {
  return (
    token.startsWith(SESSION_PREFIX) &&
    token.length >= 40 &&
    token.length <= MAX_TOKEN_LEN &&
    /^[a-zA-Z0-9_-]+$/.test(token)
  );
}

export function maskToken(token: string): string {
  if (token.length < 12) return "****";
  return `${token.slice(0, 8)}…${token.slice(-4)}`;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(`${pepper()}:${password}`, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!stored.startsWith("scrypt:")) return false;
  const parts = stored.split(":");
  if (parts.length !== 3) return false;
  const salt = parts[1];
  const expected = parts[2];
  const actual = scryptSync(`${pepper()}:${password}`, salt, 64).toString("hex");
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/i;

export function isValidUsername(username: string): boolean {
  return USERNAME_RE.test(username.trim());
}
