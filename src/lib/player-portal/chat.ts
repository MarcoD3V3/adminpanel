import { randomBytes } from "node:crypto";
import { loadAuthStore } from "@/lib/launcher-auth/store";
import { getSqliteDb } from "@/lib/db/sqlite";
import { listPresenceRecords } from "@/lib/live-ops/service";

const MAX_MESSAGE_LEN = 2000;
const MAX_MESSAGES_PER_THREAD = 200;

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
};

export type PortalChatMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  createdAt: string;
  mine: boolean;
};

function msgId(): string {
  return `pmsg_${randomBytes(8).toString("hex")}`;
}

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

async function findUserByUsername(username: string) {
  const store = await loadAuthStore();
  const normalized = normalizeUsername(username);
  return store.users.find((u) => !u.revoked && u.username.toLowerCase() === normalized) ?? null;
}

function friendIds(userId: string): Set<string> {
  const rows = getSqliteDb()
    .prepare("SELECT friend_user_id FROM portal_friends WHERE user_id = ?")
    .all(userId) as Array<{ friend_user_id: string }>;
  return new Set(rows.map((r) => r.friend_user_id));
}

function isFriend(userId: string, otherUserId: string): boolean {
  const row = getSqliteDb()
    .prepare("SELECT 1 AS ok FROM portal_friends WHERE user_id = ? AND friend_user_id = ?")
    .get(userId, otherUserId) as { ok: number } | undefined;
  return Boolean(row?.ok);
}

async function findActiveUser(userId: string) {
  const store = await loadAuthStore();
  return store.users.find((u) => u.id === userId && !u.revoked) ?? null;
}

/** Elimina amistades y mensajes de un usuario borrado o revocado permanentemente. */
export function removePortalChatDataForUser(userId: string): void {
  const db = getSqliteDb();
  db.prepare("DELETE FROM portal_friends WHERE user_id = ? OR friend_user_id = ?").run(userId, userId);
  db.prepare("DELETE FROM portal_messages WHERE sender_id = ? OR recipient_id = ?").run(userId, userId);
}

function pruneStalePortalFriends(viewerId: string, validFriendIds: Set<string>): void {
  const stale = [...friendIds(viewerId)].filter((id) => !validFriendIds.has(id));
  if (!stale.length) return;
  const db = getSqliteDb();
  const del = db.prepare("DELETE FROM portal_friends WHERE user_id = ? AND friend_user_id = ?");
  for (const friendId of stale) {
    del.run(viewerId, friendId);
  }
}

export async function listPortalChatFriends(userId: string): Promise<PortalChatFriend[]> {
  const store = await loadAuthStore();
  const presences = await listPresenceRecords();
  const onlineByUser = new Map<string, { lastSeenAt: string }>();
  for (const p of presences) {
    if (p.userId) onlineByUser.set(p.userId, { lastSeenAt: p.lastSeenAt });
  }

  const ids = [...friendIds(userId)];
  if (!ids.length) return [];

  const validIds = new Set<string>();
  const friends: PortalChatFriend[] = [];
  for (const fid of ids) {
    const user = store.users.find((u) => u.id === fid && !u.revoked);
    if (!user) continue;
    validIds.add(fid);

    const lastRow = getSqliteDb()
      .prepare(
        `SELECT body, created_at FROM portal_messages
         WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
         ORDER BY datetime(created_at) DESC LIMIT 1`
      )
      .get(userId, fid, fid, userId) as { body: string; created_at: string } | undefined;

    const online = onlineByUser.has(fid);
    friends.push({
      userId: fid,
      username: user.username,
      displayName: user.displayName ?? user.username,
      online,
      lastSeenAt: onlineByUser.get(fid)?.lastSeenAt,
      lastMessage: lastRow?.body,
      lastMessageAt: lastRow?.created_at,
    });
  }

  pruneStalePortalFriends(userId, validIds);

  return friends.sort((a, b) => {
    const ta = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
    const tb = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
    if (tb !== ta) return tb - ta;
    if (a.online !== b.online) return a.online ? -1 : 1;
    return a.username.localeCompare(b.username);
  });
}

export async function listPortalExplorePlayers(userId: string): Promise<PortalExplorePlayer[]> {
  const store = await loadAuthStore();
  const presences = await listPresenceRecords();
  const friends = friendIds(userId);
  const seen = new Set<string>();
  const result: PortalExplorePlayer[] = [];

  for (const p of presences) {
    if (!p.userId || p.userId === userId || seen.has(p.userId)) continue;
    seen.add(p.userId);
    const user = store.users.find((u) => u.id === p.userId && !u.revoked);
    if (!user) continue;
    result.push({
      userId: p.userId,
      username: user.username,
      displayName: p.displayName ?? user.username,
      premium: p.premium,
      status: p.status,
      lastSeenAt: p.lastSeenAt,
      isFriend: friends.has(p.userId),
    });
  }

  return result.sort((a, b) => {
    if (a.isFriend !== b.isFriend) return a.isFriend ? -1 : 1;
    return a.username.localeCompare(b.username);
  });
}

export function listPortalMessages(userId: string, peerUserId: string): PortalChatMessage[] {
  const rows = getSqliteDb()
    .prepare(
      `SELECT * FROM portal_messages
       WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
       ORDER BY datetime(created_at) ASC
       LIMIT ?`
    )
    .all(userId, peerUserId, peerUserId, userId, MAX_MESSAGES_PER_THREAD) as Array<{
    id: string;
    sender_id: string;
    recipient_id: string;
    body: string;
    created_at: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    senderId: r.sender_id,
    recipientId: r.recipient_id,
    body: r.body,
    createdAt: r.created_at,
    mine: r.sender_id === userId,
  }));
}

export async function addPortalFriend(
  userId: string,
  username: string
): Promise<{ ok: true; friend: PortalChatFriend } | { ok: false; error: string }> {
  const normalized = normalizeUsername(username);
  if (!normalized) return { ok: false, error: "Usuario inválido" };

  const target = await findUserByUsername(normalized);
  if (!target) return { ok: false, error: "Jugador no encontrado" };
  if (target.id === userId) return { ok: false, error: "No puedes añadirte a ti mismo" };
  if (isFriend(userId, target.id)) return { ok: false, error: "Ya está en tu lista" };

  const now = new Date().toISOString();
  getSqliteDb()
    .prepare(`INSERT INTO portal_friends (user_id, friend_user_id, created_at) VALUES (?, ?, ?)`)
    .run(userId, target.id, now);

  const presences = await listPresenceRecords();
  const online = presences.some((p) => p.userId === target.id);

  return {
    ok: true,
    friend: {
      userId: target.id,
      username: target.username,
      displayName: target.displayName ?? target.username,
      online,
      lastSeenAt: presences.find((p) => p.userId === target.id)?.lastSeenAt,
    },
  };
}

export async function sendPortalMessage(
  senderId: string,
  recipientId: string,
  body: string
): Promise<{ ok: true; message: PortalChatMessage } | { ok: false; error: string }> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Mensaje vacío" };
  if (trimmed.length > MAX_MESSAGE_LEN) {
    return { ok: false, error: `Máximo ${MAX_MESSAGE_LEN} caracteres` };
  }
  if (senderId === recipientId) return { ok: false, error: "Destinatario inválido" };
  if (!isFriend(senderId, recipientId)) {
    return { ok: false, error: "Solo puedes escribir a amigos añadidos" };
  }

  const recipient = await findActiveUser(recipientId);
  if (!recipient) {
    removePortalChatDataForUser(recipientId);
    return { ok: false, error: "Ese jugador ya no existe" };
  }

  const id = msgId();
  const createdAt = new Date().toISOString();
  getSqliteDb()
    .prepare(
      `INSERT INTO portal_messages (id, sender_id, recipient_id, body, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(id, senderId, recipientId, trimmed, createdAt);

  return {
    ok: true,
    message: {
      id,
      senderId,
      recipientId,
      body: trimmed,
      createdAt,
      mine: true,
    },
  };
}

export async function getPortalChatSnapshot(userId: string, peerUserId?: string) {
  const friends = await listPortalChatFriends(userId);
  const explore = await listPortalExplorePlayers(userId);
  const peerActive = peerUserId ? await findActiveUser(peerUserId) : null;
  const activePeerId = peerActive?.id;
  const messages =
    activePeerId && isFriend(userId, activePeerId) ? listPortalMessages(userId, activePeerId) : [];

  return { friends, explore, messages, peerUserId: activePeerId ?? null };
}
