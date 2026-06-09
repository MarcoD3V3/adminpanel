import { NextResponse } from "next/server";
import { mockSecurityAlerts, mockSecurityRules } from "@/lib/feature-data";

export async function GET() {
  return NextResponse.json({ alerts: mockSecurityAlerts, rules: mockSecurityRules });
}

export async function POST(request: Request) {
  const { action, alertId } = await request.json();
  return NextResponse.json({ success: true, action, alertId });
}
