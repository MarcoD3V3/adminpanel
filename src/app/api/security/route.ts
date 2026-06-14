import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/launcher-auth/require-admin";
import { auditAdminRequest } from "@/lib/security/guard";
import { getSecurityDashboard, resolveAlert, toggleRule } from "@/lib/security/service";

export async function GET(request: Request) {
  const denied = await requireAdminSession(request);
  if (denied) return denied;

  await auditAdminRequest(request);
  const data = getSecurityDashboard();
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const denied = await requireAdminSession(request);
  if (denied) return denied;

  const body = (await request.json()) as {
    action?: string;
    alertId?: string;
    ruleId?: string;
    enabled?: boolean;
  };
  await auditAdminRequest(request, body);

  if (body.action === "resolve" && body.alertId) {
    const alert = await resolveAlert(body.alertId);
    if (!alert) return NextResponse.json({ success: false, error: "Alerta no encontrada" }, { status: 404 });
    return NextResponse.json({ success: true, alert });
  }

  if (body.action === "toggle_rule" && body.ruleId && typeof body.enabled === "boolean") {
    const rule = await toggleRule(body.ruleId, body.enabled);
    if (!rule) return NextResponse.json({ success: false, error: "Regla no encontrada" }, { status: 404 });
    return NextResponse.json({ success: true, rule });
  }

  return NextResponse.json({ success: false, error: "Acción no válida" }, { status: 400 });
}
