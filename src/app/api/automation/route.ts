import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/launcher-auth/require-admin";
import { auditAdminRequest } from "@/lib/security/guard";
import {
  addAutomationRule,
  getAutomationDashboard,
  patchAutomationRule,
  removeAutomationRule,
  scheduleJob,
  testAutomationRule,
  tickAutomation,
  updateModeration,
} from "@/lib/automation/service";
import type { ScheduleAction } from "@/types/features";
import type { AutomationRuleRecord, ModerationSettings } from "@/lib/automation/types";

export async function GET(request: Request) {
  const denied = await requireAdminSession(request);
  if (denied) return denied;

  await auditAdminRequest(request);
  const url = new URL(request.url);

  if (url.searchParams.get("scope") === "tick") {
    const result = await tickAutomation();
    return NextResponse.json({ ok: true, ...result });
  }

  return NextResponse.json(getAutomationDashboard());
}

export async function POST(request: Request) {
  const denied = await requireAdminSession(request);
  if (denied) return denied;

  const body = (await request.json()) as Record<string, unknown>;
  await auditAdminRequest(request, body);

  if (body.scope === "tick") {
    const result = await tickAutomation();
    return NextResponse.json({ ok: true, ...result });
  }

  if (body.scope === "moderation") {
    const settings = body.settings as ModerationSettings;
    const saved = updateModeration(settings);
    return NextResponse.json({ success: true, moderation: saved });
  }

  if (body.scope === "schedule") {
    const job = scheduleJob({
      name: String(body.name ?? "Tarea programada"),
      action: body.action as ScheduleAction,
      scheduledAt: String(body.scheduledAt ?? new Date().toISOString()),
      target: (body.target as "all" | "online" | "premium") ?? "all",
      payload: (body.payload as Record<string, unknown>) ?? {},
      recurring: body.recurring as "once" | "daily" | "weekly" | undefined,
    });
    return NextResponse.json({ success: true, job });
  }

  if (body.scope === "test" && body.ruleId) {
    const ok = await testAutomationRule(String(body.ruleId));
    return NextResponse.json({ success: ok });
  }

  try {
    const rule = addAutomationRule({
      name: String(body.name ?? "Nueva regla"),
      triggerType: body.triggerType as AutomationRuleRecord["triggerType"],
      triggerConfig: (body.triggerConfig as Record<string, unknown>) ?? {},
      actionType: body.actionType as AutomationRuleRecord["actionType"],
      actionConfig: (body.actionConfig as Record<string, unknown>) ?? {},
      enabled: body.enabled !== false,
    });
    return NextResponse.json({ success: true, rule });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo crear la regla";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const denied = await requireAdminSession(request);
  if (denied) return denied;

  const body = (await request.json()) as { id?: string } & Partial<AutomationRuleRecord>;
  await auditAdminRequest(request, body);

  if (!body.id) {
    return NextResponse.json({ success: false, error: "id requerido" }, { status: 400 });
  }

  const rule = patchAutomationRule(body.id, body);
  if (!rule) {
    return NextResponse.json({ success: false, error: "Regla no encontrada" }, { status: 404 });
  }
  return NextResponse.json({ success: true, rule });
}

export async function DELETE(request: Request) {
  const denied = await requireAdminSession(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ success: false, error: "id requerido" }, { status: 400 });
  }

  await auditAdminRequest(request, { id });
  const ok = removeAutomationRule(id);
  return NextResponse.json({ success: ok });
}
