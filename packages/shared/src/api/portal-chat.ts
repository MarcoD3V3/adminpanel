import type { LauncherAuthHeaders } from "../types/launcher-auth";

function apiUrl(apiBase: string, path: string): string {
  const base = apiBase.replace(/\/$/, "");
  return base ? `${base}${path}` : path;
}

function authHeaders(auth: LauncherAuthHeaders): HeadersInit {
  return {
    Authorization: auth.authorization,
    "X-Device-Id": auth.deviceId,
    "X-Device-Fingerprint": auth.fingerprint,
    "X-Client-Kind": "launcher",
    "Content-Type": "application/json",
  };
}

export type PortalChatFriend = {
  userId: string;
  username: string;
  displayName: string;
  online: boolean;
  lastSeenAt?: string;
  lastMessage?: string;
  lastMessageAt?: string;
};

export type PortalExplorePlayer = {
  userId: string;
  username: string;
  displayName: string;
  premium: boolean;
  status: string;
  lastSeenAt: string;
  isFriend: boolean;
  client: "portal" | "launcher";
  pendingRequest?: boolean;
};

export type PortalChatMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  createdAt: string;
  mine: boolean;
};

export type PortalFriendRequest = {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  createdAt: string;
  direction: "incoming" | "outgoing";
};

export type PortalChatSnapshot = {
  friends: PortalChatFriend[];
  explore: PortalExplorePlayer[];
  requests: PortalFriendRequest[];
  messages: PortalChatMessage[];
  peerUserId: string | null;
  incomingRequestCount: number;
};

export async function fetchPortalChat(
  apiBase: string,
  auth: LauncherAuthHeaders,
  peerUserId?: string
): Promise<{ ok: boolean; chat?: PortalChatSnapshot; error?: string }> {
  try {
    const url = peerUserId
      ? `${apiUrl(apiBase, "/api/player-portal/chat")}?peer=${encodeURIComponent(peerUserId)}`
      : apiUrl(apiBase, "/api/player-portal/chat");
    const res = await fetch(url, { headers: authHeaders(auth), cache: "no-store" });
    const data = (await res.json()) as { ok?: boolean; chat?: PortalChatSnapshot; error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? `HTTP ${res.status}` };
    return { ok: true, chat: data.chat };
  } catch {
    return { ok: false, error: "No se pudo conectar al servidor" };
  }
}

export async function postPortalChat(
  apiBase: string,
  auth: LauncherAuthHeaders,
  body: Record<string, unknown>
): Promise<{ ok: boolean; chat?: PortalChatSnapshot; error?: string; type?: string }> {
  try {
    const res = await fetch(apiUrl(apiBase, "/api/player-portal/chat"), {
      method: "POST",
      headers: authHeaders(auth),
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      chat?: PortalChatSnapshot;
      error?: string;
      type?: string;
    };
    if (!res.ok || !data.ok) return { ok: false, error: data.error ?? `HTTP ${res.status}` };
    return { ok: true, chat: data.chat, type: data.type };
  } catch {
    return { ok: false, error: "No se pudo conectar al servidor" };
  }
}
