import { NextResponse } from "next/server";
import { mockLaunchers } from "@/lib/mock-data";

export async function GET() {
  return NextResponse.json({ launchers: mockLaunchers });
}

export async function POST(request: Request) {
  const { action, launcherId, payload } = await request.json();

  // En producción: enviar via WebSocket al launcher específico
  return NextResponse.json({
    success: true,
    message: `Acción "${action}" encolada para launcher ${launcherId}`,
    payload,
  });
}
