import { NextResponse } from "next/server";
import { mockLaunchers } from "@/lib/mock-data";
import { requireAdminSession } from "@/lib/launcher-auth/require-admin";

export async function GET() {
  const denied = await requireAdminSession();
  if (denied) return denied;

  return NextResponse.json({ launchers: mockLaunchers });
}

export async function POST(request: Request) {
  const denied = await requireAdminSession();
  if (denied) return denied;

  const { action, launcherId, payload } = await request.json();

  return NextResponse.json({
    success: true,
    message: `Acción "${action}" encolada para launcher ${launcherId}`,
    payload,
  });
}
