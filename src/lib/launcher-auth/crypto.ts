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

const SCRYPT_V1_OPTS = { N: 16384, r: 8, p: 1 } as const;
const SCRYPT_V2_OPTS = { N: 32768, r: 8, p: 2 } as const;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(`${pepper()}:${password}`, salt, 64, SCRYPT_V2_OPTS).toString("hex");
  return `scrypt2:${salt}:${hash}`;
}

function verifyScryptHash(
  password: string,
  salt: string,
  expected: string,
  opts: { N: number; r: number; p: number }
): boolean {
  const actual = scryptSync(`${pepper()}:${password}`, salt, 64, opts).toString("hex");
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function verifyPassword(password: string, stored: string): boolean {
  if (stored.startsWith("scrypt2:")) {
    const parts = stored.split(":");
    if (parts.length !== 3) return false;
    return verifyScryptHash(password, parts[1], parts[2], SCRYPT_V2_OPTS);
  }
  if (stored.startsWith("scrypt:")) {
    const parts = stored.split(":");
    if (parts.length !== 3) return false;
    return verifyScryptHash(password, parts[1], parts[2], SCRYPT_V1_OPTS);
  }
  return false;
}

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/i;

export function isValidUsername(username: string): boolean {
  return USERNAME_RE.test(username.trim());
}
