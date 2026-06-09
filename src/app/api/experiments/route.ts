import { NextResponse } from "next/server";
import { mockExperiments } from "@/lib/feature-data";

export async function GET() {
  return NextResponse.json({ experiments: mockExperiments });
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({ success: true, experiment: body });
}
