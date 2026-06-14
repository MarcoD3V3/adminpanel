import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/launcher-auth/require-admin";
import { runIntegrationTest } from "@/lib/integrations/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const denied = await requireAdminSession(request);
  if (denied) return denied;

  const { id } = await context.params;
  const result = await runIntegrationTest(id);

  if (!result) {
    return NextResponse.json({ success: false, error: "Integración no encontrada" }, { status: 404 });
  }

  return NextResponse.json({
    success: result.success,
    delivery: result.delivery,
    error: result.error,
    statusCode: result.statusCode,
  });
}
