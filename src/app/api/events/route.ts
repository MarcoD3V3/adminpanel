import { NextResponse } from "next/server";
import { mockEvents } from "@/lib/mock-data";

export async function GET() {
  return NextResponse.json({ events: mockEvents });
}

export async function POST(request: Request) {
  const body = await request.json();

  // En producción: ejecutar evento remoto via WebSocket
  return NextResponse.json({
    success: true,
    event: {
      id: `e${Date.now()}`,
      ...body,
      status: "pending",
      createdAt: new Date().toISOString(),
      executedCount: 0,
    },
  });
}
