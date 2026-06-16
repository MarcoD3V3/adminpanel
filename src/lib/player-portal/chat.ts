import { randomBytes } from "node:crypto";
import { loadAuthStore } from "@/lib/launcher-auth/store";
import { getSqliteDb } from "@/lib/db/sqlite";
import { listPresenceRecords } from "@/lib/live-ops/service";

const MAX_MESSAGE_LEN = 2000;
const MAX_MESSAGES_PER_THREAD = 200;
const PORTAL_PRESENCE_TTL_MS = 90_000;

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

function msgId(): string {
  return `pmsg_${randomBytes(8).toString("hex")}`;
}

function requestId(): string {
  return `pfreq_${randomBytes(8).toString("hex")}`;
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

/** Pueden chatear si cualquiera tiene al otro en su lista de amigos. */
function canChat(userId: string, otherUserId: string): boolean {
  return isFriend(userId, otherUserId) || isFriend(otherUserId, userId);
}

async function findActiveUser(userId: string) {
  const store = await loadAuthStore();
  return store.users.find((u) => u.id === userId && !u.revoked) ?? null;
}

function linkFriends(userA: string, userB: string): void {
  const now = new Date().toISOString();
  const db = getSqliteDb();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO portal_friends (user_id, friend_user_id, created_at) VALUES (?, ?, ?)`
  );
  insert.run(userA, userB, now);
  insert.run(userB, userA, now);
}

function clearFriendRequestsBetween(userA: string, userB: string): void {
  getSqliteDb()
    .prepare(
      `DELETE FROM portal_friend_requests
       WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)`
    )
    .run(userA, userB, userB, userA);
}

export function upsertPortalWebPresence(
  userId: string,
  username: string,
  displayName?: string
): void {
  const now = new Date().toISOString();
  getSqliteDb()
    .prepare(
      `INSERT INTO portal_presence (user_id, username, display_name, client, status, last_seen_at)
       VALUES (?, ?, ?, 'portal', 'online', ?)
       ON CONFLICT(user_id) DO UPDATE SET
         username = excluded.username,
         display_name = excluded.display_name,
         client = 'portal',
         status = 'online',
         last_seen_at = excluded.last_seen_at`
    )
    .run(userId, username, displayName ?? username, now);
}

function prunePortalPresence(): void {
  const cutoff = new Date(Date.now() - PORTAL_PRESENCE_TTL_MS).toISOString();
  getSqliteDb().prepare("DELETE FROM portal_presence WHERE last_seen_at < ?").run(cutoff);
}

function listPortalWebPresence(): Array<{
  user_id: string;
  username: string;
  display_name: string;
  client: string;
  status: string;
  last_seen_at: string;
}> {
  prunePortalPresence();
  return getSqliteDb()
    .prepare("SELECT * FROM portal_presence ORDER BY last_seen_at DESC")
    .all() as Array<{
    user_id: string;
    username: string;
    display_name: string;
    client: string;
    status: string;
    last_seen_at: string;
  }>;
}

/** Elimina amistades, solicitudes y mensajes de un usuario borrado o revocado. */
export function removePortalChatDataForUser(userId: string): void {
  const db = getSqliteDb();
  db.prepare("DELETE FROM portal_friends WHERE user_id = ? OR friend_user_id = ?").run(userId, userId);
  db.prepare("DELETE FROM portal_messages WHERE sender_id = ? OR recipient_id = ?").run(userId, userId);
  db.prepare("DELETE FROM portal_friend_requests WHERE from_user_id = ? OR to_user_id = ?").run(userId, userId);
  db.prepare("DELETE FROM portal_presence WHERE user_id = ?").run(userId);
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

async function onlineUsersMap(): Promise<Map<string, { lastSeenAt: string; client: "portal" | "launcher" }>> {
  const map = new Map<string, { lastSeenAt: string; client: "portal" | "launcher" }>();

  for (const p of await listPresenceRecords()) {
    if (!p.userId) continue;
    map.set(p.userId, { lastSeenAt: p.lastSeenAt, client: "launcher" });
  }

  for (const p of listPortalWebPresence()) {
    const existing = map.get(p.user_id);
    if (!existing || Date.parse(p.last_seen_at) > Date.parse(existing.lastSeenAt)) {
      map.set(p.user_id, { lastSeenAt: p.last_seen_at, client: "portal" });
    }
  }

  return map;
}

export async function listPortalFriendRequests(userId: string): Promise<PortalFriendRequest[]> {
  const store = await loadAuthStore();
  const rows = getSqliteDb()
    .prepare(
      `SELECT * FROM portal_friend_requests
       WHERE status = 'pending' AND (from_user_id = ? OR to_user_id = ?)
       ORDER BY datetime(created_at) DESC`
    )
    .all(userId, userId) as Array<{
    id: string;
    from_user_id: string;
    to_user_id: string;
    created_at: string;
  }>;

  const result: PortalFriendRequest[] = [];
  for (const row of rows) {
    const incoming = row.to_user_id === userId;
    const otherId = incoming ? row.from_user_id : row.to_user_id;
    const user = store.users.find((u) => u.id === otherId && !u.revoked);
    if (!user) continue;
    result.push({
      id: row.id,
      userId: otherId,
      username: user.username,
      displayName: user.displayName ?? user.username,
      createdAt: row.created_at,
      direction: incoming ? "incoming" : "outgoing",
    });
  }
  return result;
}

export async function listPortalChatFriends(userId: string): Promise<PortalChatFriend[]> {
  const store = await loadAuthStore();
  const onlineMap = await onlineUsersMap();

  const ids = new Set<string>();
  for (const fid of friendIds(userId)) ids.add(fid);
  const rows = getSqliteDb()
    .prepare("SELECT user_id FROM portal_friends WHERE friend_user_id = ?")
    .all(userId) as Array<{ user_id: string }>;
  for (const r of rows) ids.add(r.user_id);

  if (!ids.size) return [];

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

    const online = onlineMap.has(fid);
    friends.push({
      userId: fid,
      username: user.username,
      displayName: user.displayName ?? user.username,
      online,
      lastSeenAt: onlineMap.get(fid)?.lastSeenAt,
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
  const friends = friendIds(userId);
  const onlineMap = await onlineUsersMap();
  const pendingOutgoing = new Set(
    (
      getSqliteDb()
        .prepare(
          `SELECT to_user_id FROM portal_friend_requests WHERE from_user_id = ? AND status = 'pending'`
        )
        .all(userId) as Array<{ to_user_id: string }>
    ).map((r) => r.to_user_id)
  );

  const result: PortalExplorePlayer[] = [];

  for (const [uid, meta] of onlineMap) {
    if (uid === userId) continue;
    const user = store.users.find((u) => u.id === uid && !u.revoked);
    if (!user) continue;

    const launcherPresence = (await listPresenceRecords()).find((p) => p.userId === uid);
    result.push({
      userId: uid,
      username: user.username,
      displayName: user.displayName ?? user.username,
      premium: launcherPresence?.premium ?? false,
      status: meta.client === "portal" ? "En el portal" : launcherPresence?.status ?? "online",
      lastSeenAt: meta.lastSeenAt,
      isFriend: friends.has(uid) || isFriend(uid, userId),
      client: meta.client,
      pendingRequest: pendingOutgoing.has(uid),
    });
  }

  return result.sort((a, b) => {
    if (a.isFriend !== b.isFriend) return a.isFriend ? -1 : 1;
    if (a.client !== b.client) return a.client === "launcher" ? -1 : 1;
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

async function buildFriendSummary(userId: string, targetId: string): Promise<PortalChatFriend> {
  const user = await findActiveUser(targetId);
  if (!user) throw new Error("Usuario no encontrado");
  const onlineMap = await onlineUsersMap();
  return {
    userId: targetId,
    username: user.username,
    displayName: user.displayName ?? user.username,
    online: onlineMap.has(targetId),
    lastSeenAt: onlineMap.get(targetId)?.lastSeenAt,
  };
}

export async function sendPortalFriendRequest(
  userId: string,
  username: string
): Promise<
  | { ok: true; type: "request_sent"; request: PortalFriendRequest }
  | { ok: true; type: "accepted"; friend: PortalChatFriend }
  | { ok: false; error: string }
> {
  const normalized = normalizeUsername(username);
  if (!normalized) return { ok: false, error: "Usuario inválido" };

  const target = await findUserByUsername(normalized);
  if (!target) return { ok: false, error: "Jugador no encontrado" };
  if (target.id === userId) return { ok: false, error: "No puedes añadirte a ti mismo" };
  if (canChat(userId, target.id)) return { ok: false, error: "Ya sois amigos" };

  const db = getSqliteDb();
  const reciprocal = db
    .prepare(
      `SELECT id FROM portal_friend_requests
       WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'`
    )
    .get(target.id, userId) as { id: string } | undefined;

  if (reciprocal) {
    linkFriends(userId, target.id);
    clearFriendRequestsBetween(userId, target.id);
    return { ok: true, type: "accepted", friend: await buildFriendSummary(userId, target.id) };
  }

  const existing = db
    .prepare(
      `SELECT id, status FROM portal_friend_requests WHERE from_user_id = ? AND to_user_id = ?`
    )
    .get(userId, target.id) as { id: string; status: string } | undefined;

  if (existing?.status === "pending") {
    return { ok: false, error: "Solicitud ya enviada" };
  }

  const now = new Date().toISOString();
  const id = requestId();
  if (existing) {
    db.prepare(
      `UPDATE portal_friend_requests SET status = 'pending', updated_at = ? WHERE id = ?`
    ).run(now, existing.id);
  } else {
    db.prepare(
      `INSERT INTO portal_friend_requests (id, from_user_id, to_user_id, status, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', ?, ?)`
    ).run(id, userId, target.id, now, now);
  }

  const request: PortalFriendRequest = {
    id: existing?.id ?? id,
    userId: target.id,
    username: target.username,
    displayName: target.displayName ?? target.username,
    createdAt: now,
    direction: "outgoing",
  };

  return { ok: true, type: "request_sent", request };
}

export async function acceptPortalFriendRequest(
  userId: string,
  requestIdOrFromUserId: string
): Promise<{ ok: true; friend: PortalChatFriend } | { ok: false; error: string }> {
  const db = getSqliteDb();
  let row = db
    .prepare(
      `SELECT * FROM portal_friend_requests
       WHERE id = ? AND to_user_id = ? AND status = 'pending'`
    )
    .get(requestIdOrFromUserId, userId) as
    | { id: string; from_user_id: string; to_user_id: string }
    | undefined;

  if (!row) {
    row = db
      .prepare(
        `SELECT * FROM portal_friend_requests
         WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'`
      )
      .get(requestIdOrFromUserId, userId) as typeof row;
  }

  if (!row) return { ok: false, error: "Solicitud no encontrada" };

  const fromUser = await findActiveUser(row.from_user_id);
  if (!fromUser) {
    clearFriendRequestsBetween(row.from_user_id, userId);
    return { ok: false, error: "Ese jugador ya no existe" };
  }

  linkFriends(userId, row.from_user_id);
  clearFriendRequestsBetween(userId, row.from_user_id);

  return { ok: true, friend: await buildFriendSummary(userId, row.from_user_id) };
}

export async function declinePortalFriendRequest(
  userId: string,
  requestIdOrFromUserId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getSqliteDb();
  const result = db
    .prepare(
      `UPDATE portal_friend_requests
       SET status = 'declined', updated_at = ?
       WHERE status = 'pending' AND to_user_id = ?
         AND (id = ? OR from_user_id = ?)`
    )
    .run(new Date().toISOString(), userId, requestIdOrFromUserId, requestIdOrFromUserId);

  if (!result.changes) return { ok: false, error: "Solicitud no encontrada" };
  return { ok: true };
}

/** @deprecated Usa sendPortalFriendRequest — mantiene compatibilidad con add_friend */
export async function addPortalFriend(
  userId: string,
  username: string
): Promise<{ ok: true; friend: PortalChatFriend } | { ok: false; error: string }> {
  const result = await sendPortalFriendRequest(userId, username);
  if (!result.ok) return result;
  if (result.type === "accepted") return { ok: true, friend: result.friend };
  return { ok: false, error: "Solicitud enviada — espera a que la acepten" };
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
  if (!canChat(senderId, recipientId)) {
    return { ok: false, error: "Solo puedes escribir a amigos aceptados" };
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

export async function getPortalChatSnapshot(
  userId: string,
  peerUserId?: string,
  presence?: { username: string; displayName?: string }
) {
  if (presence?.username) {
    upsertPortalWebPresence(userId, presence.username, presence.displayName);
  }

  const friends = await listPortalChatFriends(userId);
  const explore = await listPortalExplorePlayers(userId);
  const requests = await listPortalFriendRequests(userId);
  const peerActive = peerUserId ? await findActiveUser(peerUserId) : null;
  const activePeerId = peerActive?.id;
  const messages =
    activePeerId && canChat(userId, activePeerId)
      ? listPortalMessages(userId, activePeerId)
      : [];

  return {
    friends,
    explore,
    requests,
    messages,
    peerUserId: activePeerId ?? null,
    incomingRequestCount: requests.filter((r) => r.direction === "incoming").length,
  };
}
