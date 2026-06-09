import { NextResponse } from "next/server";
import { getDashboardStats, mockActivity } from "@/lib/mock-data";

export async function GET() {
  return NextResponse.json({
    stats: getDashboardStats(),
    activity: mockActivity,
  });
}
