import { NextResponse } from "next/server";
import { mockUsers } from "@/lib/mock-data";

export async function GET() {
  return NextResponse.json({ users: mockUsers });
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({ success: true, user: { id: `u${Date.now()}`, ...body } });
}
