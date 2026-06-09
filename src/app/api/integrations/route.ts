import { NextResponse } from "next/server";
import { mockIntegrations } from "@/lib/feature-data";

export async function GET() {
  return NextResponse.json({ integrations: mockIntegrations });
}

export async function POST(request: Request) {
  const { integrationId, test } = await request.json();
  return NextResponse.json({ success: true, integrationId, test: test ?? false });
}
