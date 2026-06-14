import { NextResponse } from "next/server";
import { auditClientSideReport } from "@/lib/security/guard";
import type { SecurityDetectionType } from "@/types/features";
import { DETECTION_BY_TYPE } from "@/lib/security/catalog";

const CLIENT_TYPES = new Set([
  "admin_cookie_tamper",
  "admin_data_tamper",
  "admin_header_spoof",
  "launcher_code_injection",
  "launcher_debugger_attached",
  "launcher_env_tamper",
  "launcher_bot_automation",
]);

export async function POST(request: Request) {
  const body = (await request.json()) as {
    type?: SecurityDetectionType;
    detail?: string;
    metadata?: Record<string, unknown>;
  };

  if (!body.type || !CLIENT_TYPES.has(body.type) || !body.detail?.trim()) {
    return NextResponse.json({ success: false, error: "Reporte inválido" }, { status: 400 });
  }

  if (!DETECTION_BY_TYPE[body.type]) {
    return NextResponse.json({ success: false, error: "Tipo desconocido" }, { status: 400 });
  }

  await auditClientSideReport({
    type: body.type,
    detail: body.detail.trim(),
    metadata: body.metadata,
  });

  return NextResponse.json({ success: true });
}
