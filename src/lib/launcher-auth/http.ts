import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSecret,
  verifyAdminSessionValue,
} from "./admin-session";
import { secureCompareSecret } from "./crypto";

const LAUNCHER_ORIGINS = [
  "http://localhost:1420",
  "http://127.0.0.1:1420",
  process.env.LAUNCHER_ORIGIN,
].filter(Boolean) as string[];

export function securityHeaders(): HeadersInit {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "interest-cohort=()",
  };
}

export function corsHeaders(origin: string | null): HeadersInit {
  const base = securityHeaders();
  const allowAll =
    !origin || origin === "null" || LAUNCHER_ORIGINS.includes(origin);

  if (!allowAll) return base;

  return {
    ...base,
    "Access-Control-Allow-Origin": origin && LAUNCHER_ORIGINS.includes(origin) ? origin : "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Device-Id, X-Device-Fingerprint",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function jsonWithCors(data: unknown, init: ResponseInit, origin: string | null) {
  const headers = new Headers(init.headers);
  const cors = corsHeaders(origin);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  return NextResponse.json(data, { ...init, headers });
}

export function jsonSecure(data: unknown, init: ResponseInit = { status: 200 }) {
  const headers = new Headers(init.headers);
  for (const [k, v] of Object.entries(securityHeaders())) headers.set(k, v);
  return NextResponse.json(data, { ...init, headers });
}

export function optionsResponse(origin: string | null) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function assertAdminKey(headerKey: string | null): boolean {
  return secureCompareSecret(headerKey, process.env.LAUNCHER_ADMIN_SECRET ?? null);
}

export async function assertAdminSession(): Promise<boolean> {
  const jar = await cookies();
  const value = jar.get(ADMIN_SESSION_COOKIE)?.value;
  return verifyAdminSessionValue(value);
}

export async function assertAdminAccess(request: Request): Promise<boolean> {
  if (await assertAdminSession()) return true;
  return assertAdminKey(request.headers.get("x-admin-key"));
}

export function isSameOriginAdminRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!host) return false;
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return url.host === host;
  } catch {
    return false;
  }
}

export function rejectActivationResponse(origin: string | null) {
  return jsonWithCors(
    { error: "Activación rechazada. Comprueba el token o solicita uno nuevo." },
    { status: 401 },
    origin
  );
}
