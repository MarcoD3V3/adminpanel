import { NextResponse } from "next/server";
import { mockMissions } from "@/lib/feature-data";

export async function GET() {
  return NextResponse.json({ missions: mockMissions });
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({ success: true, mission: body });
}
