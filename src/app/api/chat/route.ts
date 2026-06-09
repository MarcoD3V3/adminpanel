import { NextResponse } from "next/server";
import { mockChatMessages } from "@/lib/mock-data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channel = searchParams.get("channel");

  const messages = channel
    ? mockChatMessages.filter((m) => m.channel === channel)
    : mockChatMessages;

  return NextResponse.json({ messages });
}

export async function DELETE(request: Request) {
  const { messageId } = await request.json();
  return NextResponse.json({ success: true, deleted: messageId });
}
