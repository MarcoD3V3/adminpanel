import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/launcher-auth/require-admin";
import { auditAdminRequest } from "@/lib/security/guard";
import {
  getSettingsDashboard,
  rotateOAuthSecret,
  runDatabaseBackup,
  runDatabaseTest,
  updateSettings,
} from "@/lib/settings/service";
import type { SettingsPatch } from "@/lib/settings/types";
import { toPublicSettings } from "@/lib/settings/store";

export async function GET(request: Request) {
  const denied = await requireAdminSession(request);
  if (denied) return denied;

  await auditAdminRequest(request);
  const url = new URL(request.url);

  if (url.searchParams.get("scope") === "db-test") {
    return NextResponse.json(runDatabaseTest());
  }

  return NextResponse.json(await getSettingsDashboard());
}

export async function PATCH(request: Request) {
  const denied = await requireAdminSession(request);
  if (denied) return denied;

  const body = (await request.json()) as SettingsPatch;
  await auditAdminRequest(request, body);

  const settings = updateSettings(body);
  return NextResponse.json({ success: true, settings: toPublicSettings(settings) });
}

export async function POST(request: Request) {
  const denied = await requireAdminSession(request);
  if (denied) return denied;

  const body = (await request.json()) as { scope?: string };
  await auditAdminRequest(request, body);

  if (body.scope === "regenerate-oauth-secret") {
    const settings = rotateOAuthSecret();
    return NextResponse.json({ success: true, settings: toPublicSettings(settings) });
  }

  if (body.scope === "db-backup") {
    const result = runDatabaseBackup();
    return NextResponse.json(result);
  }

  if (body.scope === "db-test") {
    return NextResponse.json(runDatabaseTest());
  }

  return NextResponse.json({ success: false, error: "scope inválido" }, { status: 400 });
}
