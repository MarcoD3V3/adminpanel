import { NextResponse } from "next/server";
import { mockChatMessages } from "@/lib/mock-data";
import { requireAdminSession } from "@/lib/launcher-auth/require-admin";

export async function GET(request: Request) {
  const denied = await requireAdminSession();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const channel = searchParams.get("channel");

  const messages = channel
    ? mockChatMessages.filter((m) => m.channel === channel)
    : mockChatMessages;

  return NextResponse.json({ messages });
}

export async function DELETE(request: Request) {
  const denied = await requireAdminSession();
  if (denied) return denied;

  const { messageId } = await request.json();
  return NextResponse.json({ success: true, deleted: messageId });
}
