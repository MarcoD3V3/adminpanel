import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/launcher-auth/require-admin";
import { auditAdminRequest } from "@/lib/security/guard";
import { checkChatMessage, reportChatMessage } from "@/lib/automation/moderation";

export async function POST(request: Request) {
  const denied = await requireAdminSession(request);
  if (denied) return denied;

  const body = (await request.json()) as {
    scope?: string;
    message?: string;
    username?: string;
    reporter?: string;
    reported?: string;
    reason?: string;
    reportedUserId?: string;
  };

  await auditAdminRequest(request, body);

  if (body.scope === "check") {
    const result = checkChatMessage(body.message ?? "", body.username ?? "");
    return NextResponse.json(result);
  }

  if (body.scope === "report") {
    const result = reportChatMessage({
      reporter: body.reporter ?? "admin",
      reported: body.reported ?? body.username ?? "",
      reason: body.reason ?? "reportado",
      reportedUserId: body.reportedUserId,
      message: body.message,
    });
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "scope inválido" }, { status: 400 });
}
