import { NextResponse } from "next/server";
import { mockIntegrations } from "@/lib/feature-data";
import { requireAdminSession } from "@/lib/launcher-auth/require-admin";

export async function GET() {
  const denied = await requireAdminSession();
  if (denied) return denied;

  return NextResponse.json({ integrations: mockIntegrations });
}

export async function POST(request: Request) {
  const denied = await requireAdminSession();
  if (denied) return denied;

  const { integrationId, test } = await request.json();
  return NextResponse.json({ success: true, integrationId, test: test ?? false });
}
