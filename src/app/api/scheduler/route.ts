import { NextResponse } from "next/server";
import { mockScheduledEvents } from "@/lib/feature-data";
import { requireAdminSession } from "@/lib/launcher-auth/require-admin";

export async function GET() {
  const denied = await requireAdminSession();
  if (denied) return denied;

  return NextResponse.json({ events: mockScheduledEvents });
}

export async function POST(request: Request) {
  const denied = await requireAdminSession();
  if (denied) return denied;

  const body = await request.json();
  return NextResponse.json({ success: true, event: body });
}
