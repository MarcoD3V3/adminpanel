import { NextResponse } from "next/server";
import { mockSecurityAlerts, mockSecurityRules } from "@/lib/feature-data";
import { requireAdminSession } from "@/lib/launcher-auth/require-admin";

export async function GET() {
  const denied = await requireAdminSession();
  if (denied) return denied;

  return NextResponse.json({ alerts: mockSecurityAlerts, rules: mockSecurityRules });
}

export async function POST(request: Request) {
  const denied = await requireAdminSession();
  if (denied) return denied;

  const { action, alertId } = await request.json();
  return NextResponse.json({ success: true, action, alertId });
}
