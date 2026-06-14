import type { NextResponse } from "next/server";
import { assertAdminAccess, assertAdminSession, clientIp, jsonSecure } from "./http";
import { auditUnauthorizedAdmin } from "@/lib/security/guard";

export async function requireAdminSession(request?: Request): Promise<NextResponse | null> {
  if (await assertAdminSession()) return null;
  const path = request ? new URL(request.url).pathname : "/api/admin";
  const ip = request ? clientIp(request) : "unknown";
  await auditUnauthorizedAdmin(path, ip);
  return jsonSecure({ error: "No autorizado. Inicia sesión en el panel admin." }, { status: 401 });
}

/** Sesión admin o cabecera X-Admin-Key (sync servidor ↔ Railway). */
export async function requireAdminAccess(request: Request): Promise<NextResponse | null> {
  if (await assertAdminAccess(request)) return null;
  await auditUnauthorizedAdmin(new URL(request.url).pathname, clientIp(request));
  return jsonSecure({ error: "No autorizado. Inicia sesión en el panel admin." }, { status: 401 });
}
