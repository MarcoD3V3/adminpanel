import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/launcher-auth/require-admin";
import { auditAdminRequest } from "@/lib/security/guard";
import { patchIntegration, removeIntegration } from "@/lib/integrations/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const denied = await requireAdminSession(request);
  if (denied) return denied;

  const { id } = await context.params;
  const body = (await request.json()) as {
    name?: string;
    type?: "discord" | "telegram" | "slack" | "custom";
    url?: string;
    events?: string[];
    active?: boolean;
    description?: string;
    config?: Record<string, unknown>;
  };

  await auditAdminRequest(request, body);

  try {
    const integration = await patchIntegration(id, body);
    if (!integration) {
      return NextResponse.json({ success: false, error: "Integración no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ success: true, integration });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo actualizar";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const denied = await requireAdminSession(request);
  if (denied) return denied;

  const { id } = await context.params;
  const ok = await removeIntegration(id);
  if (!ok) {
    return NextResponse.json({ success: false, error: "Integración no encontrada" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
