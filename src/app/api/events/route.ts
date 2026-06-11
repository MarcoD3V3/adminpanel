import { NextResponse } from "next/server";
import { mockEvents } from "@/lib/mock-data";
import { requireAdminSession } from "@/lib/launcher-auth/require-admin";

export async function GET() {
  const denied = await requireAdminSession();
  if (denied) return denied;

  return NextResponse.json({ events: mockEvents });
}

export async function POST(request: Request) {
  const denied = await requireAdminSession();
  if (denied) return denied;

  const body = await request.json();

  return NextResponse.json({
    success: true,
    event: {
      id: `e${Date.now()}`,
      ...body,
      status: "pending",
      createdAt: new Date().toISOString(),
      executedCount: 0,
    },
  });
}
