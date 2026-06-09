import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "cl_admin_session";
/** Sesión corta (sin «recordarme»). */
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
/** Sesión persistente hasta cerrar sesión manualmente. */
export const ADMIN_REMEMBER_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function adminSecret(): string | null {
  const secret = process.env.LAUNCHER_ADMIN_SECRET;
  if (!secret || secret.length < 16) {
    if (process.env.NODE_ENV === "production") return null;
    return "dev-insecure-admin-key-min16";
  }
  return secret;
}

export function isAdminSecretConfigured(): boolean {
  const secret = process.env.LAUNCHER_ADMIN_SECRET;
  if (secret && secret.length >= 16) return true;
  return process.env.NODE_ENV !== "production";
}

export function verifyAdminSecret(input: string | null): boolean {
  if (!input) return false;
  const secret = adminSecret();
  if (!secret) return false;

  const normalized = input.trim();
  const a = Buffer.from(normalized);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function usesDevAdminFallback(): boolean {
  const secret = process.env.LAUNCHER_ADMIN_SECRET;
  return process.env.NODE_ENV !== "production" && (!secret || secret.length < 16);
}

export function createAdminSessionValue(remember = true): string | null {
  const secret = adminSecret();
  if (!secret) return null;

  const ttl = remember ? ADMIN_REMEMBER_TTL_MS : SESSION_TTL_MS;
  const expiresAt = Date.now() + ttl;
  const nonce = randomBytes(16).toString("hex");
  const payload = Buffer.from(JSON.stringify({ exp: expiresAt, n: nonce })).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyAdminSessionValue(value: string | null | undefined): boolean {
  if (!value) return false;
  const secret = adminSecret();
  if (!secret) return false;

  const dot = value.lastIndexOf(".");
  if (dot <= 0) return false;

  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8")) as {
      exp?: number;
    };
    return typeof parsed.exp === "number" && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

export function adminSessionCookieOptions(remember = true): {
  httpOnly: true;
  sameSite: "strict";
  secure: boolean;
  path: string;
  maxAge: number;
} {
  const ttl = remember ? ADMIN_REMEMBER_TTL_MS : SESSION_TTL_MS;
  return {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(ttl / 1000),
  };
}
