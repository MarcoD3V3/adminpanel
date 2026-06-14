import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/launcher-auth/require-admin";
import { auditAdminRequest } from "@/lib/security/guard";
import { getAutomationDashboard, scheduleJob } from "@/lib/automation/service";
import type { ScheduleAction } from "@/types/features";

export async function GET() {
  const denied = await requireAdminSession();
  if (denied) return denied;

  const { jobs } = getAutomationDashboard();
  return NextResponse.json({ events: jobs });
}

export async function POST(request: Request) {
  const denied = await requireAdminSession(request);
  if (denied) return denied;

  const body = (await request.json()) as {
    name?: string;
    action?: ScheduleAction;
    scheduledAt?: string;
    target?: "all" | "online" | "premium";
    payload?: Record<string, unknown>;
    recurring?: "once" | "daily" | "weekly";
  };

  await auditAdminRequest(request, body);

  const job = scheduleJob({
    name: String(body.name ?? "Tarea programada"),
    action: body.action ?? "notification",
    scheduledAt: body.scheduledAt ?? new Date().toISOString(),
    target: body.target ?? "all",
    payload: body.payload ?? {},
    recurring: body.recurring,
  });

  return NextResponse.json({ success: true, event: job });
}
