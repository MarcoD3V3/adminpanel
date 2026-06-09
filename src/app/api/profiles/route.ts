import { NextResponse } from "next/server";
import { mockSocialProfiles } from "@/lib/feature-data";

export async function GET() {
  return NextResponse.json({ profiles: mockSocialProfiles });
}
