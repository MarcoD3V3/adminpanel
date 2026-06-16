import { verifyRequestSession } from "@/lib/launcher-auth/service";
import { jsonWithCors, optionsResponse } from "@/lib/launcher-auth/http";
import {
  acceptPortalFriendRequest,
  declinePortalFriendRequest,
  getPortalChatSnapshot,
  sendPortalFriendRequest,
  sendPortalMessage,
} from "@/lib/player-portal/chat";

export async function OPTIONS(request: Request) {
  return optionsResponse(request.headers.get("origin"));
}

async function authSession(request: Request) {
  const deviceId = request.headers.get("x-device-id")?.trim() ?? null;
  const session = await verifyRequestSession(
    request.headers.get("authorization"),
    deviceId,
    request.headers.get("x-device-fingerprint"),
    "portal"
  );
  return { session, deviceId };
}

export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  const { session } = await authSession(request);

  if (!session.valid || !session.userId) {
    return jsonWithCors({ error: "Sesión inválida" }, { status: 401 }, origin);
  }

  const url = new URL(request.url);
  const peerUserId = url.searchParams.get("peer")?.trim() || undefined;
  const snapshot = await getPortalChatSnapshot(session.userId, peerUserId, {
    username: session.username ?? "usuario",
    displayName: session.displayName,
  });

  return jsonWithCors({ ok: true, chat: snapshot }, { status: 200 }, origin);
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const { session } = await authSession(request);

  if (!session.valid || !session.userId) {
    return jsonWithCors({ error: "Sesión inválida" }, { status: 401 }, origin);
  }

  const body = (await request.json()) as {
    action?: string;
    username?: string;
    recipientUserId?: string;
    text?: string;
    peerUserId?: string;
    requestId?: string;
    fromUserId?: string;
  };

  const presence = {
    username: session.username ?? "usuario",
    displayName: session.displayName,
  };

  if (body.action === "add_friend" && body.username) {
    const result = await sendPortalFriendRequest(session.userId, body.username);
    if (!result.ok) {
      return jsonWithCors({ error: result.error }, { status: 400 }, origin);
    }
    const chat = await getPortalChatSnapshot(
      session.userId,
      result.type === "accepted" ? result.friend.userId : undefined,
      presence
    );
    if (result.type === "accepted") {
      return jsonWithCors({ ok: true, type: "accepted", friend: result.friend, chat }, { status: 200 }, origin);
    }
    return jsonWithCors({ ok: true, type: "request_sent", request: result.request, chat }, { status: 200 }, origin);
  }

  if (body.action === "accept_friend" && (body.requestId || body.fromUserId)) {
    const key = body.requestId?.trim() || body.fromUserId?.trim() || "";
    const result = await acceptPortalFriendRequest(session.userId, key);
    if (!result.ok) {
      return jsonWithCors({ error: result.error }, { status: 400 }, origin);
    }
    const chat = await getPortalChatSnapshot(session.userId, result.friend.userId, presence);
    return jsonWithCors({ ok: true, friend: result.friend, chat }, { status: 200 }, origin);
  }

  if (body.action === "decline_friend" && (body.requestId || body.fromUserId)) {
    const key = body.requestId?.trim() || body.fromUserId?.trim() || "";
    const result = await declinePortalFriendRequest(session.userId, key);
    if (!result.ok) {
      return jsonWithCors({ error: result.error }, { status: 400 }, origin);
    }
    const chat = await getPortalChatSnapshot(session.userId, undefined, presence);
    return jsonWithCors({ ok: true, chat }, { status: 200 }, origin);
  }

  if (body.action === "send" && body.recipientUserId && body.text) {
    const result = await sendPortalMessage(session.userId, body.recipientUserId, body.text);
    if (!result.ok) {
      return jsonWithCors({ error: result.error }, { status: 400 }, origin);
    }
    const chat = await getPortalChatSnapshot(session.userId, body.recipientUserId, presence);
    return jsonWithCors({ ok: true, message: result.message, chat }, { status: 200 }, origin);
  }

  if (body.action === "sync") {
    const peer = body.peerUserId?.trim() || undefined;
    const chat = await getPortalChatSnapshot(session.userId, peer, presence);
    return jsonWithCors({ ok: true, chat }, { status: 200 }, origin);
  }

  return jsonWithCors({ error: "Acción inválida" }, { status: 400 }, origin);
}
