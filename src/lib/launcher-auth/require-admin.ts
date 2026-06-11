import type { NextResponse } from "next/server";
import { assertAdminSession, jsonSecure } from "./http";

export async function requireAdminSession(): Promise<NextResponse | null> {
  if (await assertAdminSession()) return null;
  return jsonSecure({ error: "No autorizado. Inicia sesión en el panel admin." }, { status: 401 });
}
