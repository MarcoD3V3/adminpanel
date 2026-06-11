import { NextResponse } from "next/server";
import { mockSocialProfiles } from "@/lib/feature-data";
import { requireAdminSession } from "@/lib/launcher-auth/require-admin";

export async function GET() {
  const denied = await requireAdminSession();
  if (denied) return denied;

  return NextResponse.json({ profiles: mockSocialProfiles });
}
