import { NextResponse } from "next/server";
import { mockScheduledEvents } from "@/lib/feature-data";

export async function GET() {
  return NextResponse.json({ events: mockScheduledEvents });
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({ success: true, event: body });
}
