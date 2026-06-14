import { normalizeProfilePlan } from "@craftlauncher/shared";
import {
  createLauncherUser,
  deleteLauncherUser,
  getAdminProfilesOverview,
  listAuditLog,
  resetLauncherUserPassword,
  restoreLauncherUser,
  revokeLauncherUser,
  revokeSession,
  revokeSessionsForUser,
  updateLauncherUser,
} from "@/lib/launcher-auth/service";
import { buildUserModerationIntel } from "@/lib/launcher-auth/profile-moderation";
import { listPresenceRecords } from "@/lib/live-ops/service";
import {
  apiErrorMessage,
  assertAdminSession,
  clientIp,
  isSameOriginAdminRequest,
  jsonSecure,
} from "@/lib/launcher-auth/http";

export async function GET() {
  const authenticated = await assertAdminSession();
  if (!authenticated) {
    return jsonSecure({ authenticated: false, users: [], sessions: [], auditLog: [] });
  }

  const [{ users, sessions }, auditLog, presence] = await Promise.all([
    getAdminProfilesOverview(),
    listAuditLog(120),
    listPresenceRecords(),
  ]);

  const fingerprintBySessionId = new Map(
    sessions.map((s) => [s.id, s.fingerprintPrefix ?? ""])
  );

  const moderation = users.map((user) =>
    buildUserModerationIntel(user, sessions, presence, auditLog, fingerprintBySessionId)
  );

  const stats = {
    totalUsers: users.length,
    activeUsers: users.filter((u) => !u.revoked).length,
    revokedUsers: users.filter((u) => u.revoked).length,
    activeSessions: sessions.filter((s) => !s.revoked && Date.parse(s.expiresAt) > Date.now()).length,
    usersWithSkin: users.filter((u) => u.hasSkin).length,
    launchersOnline: moderation.filter((m) => m.launcherOpen).length,
  };

  return jsonSecure({ authenticated: true, users, sessions, auditLog, moderation, stats });
}

export async function POST(request: Request) {
  try {
  if (!isSameOriginAdminRequest(request)) {
    return jsonSecure({ success: false, error: "Origen no permitido" }, { status: 403 });
  }
  if (!(await assertAdminSession())) {
    return jsonSecure({ success: false, error: "Sesión admin requerida" }, { status: 401 });
  }

  const ip = clientIp(request);
  let body: {
    action?: string;
    id?: string;
    userId?: string;
    username?: string;
    password?: string;
    displayName?: string;
    tier?: string;
    email?: string;
    notes?: string;
    referralCode?: string;
    temporaryMinutes?: number;
    singleUse?: boolean;
    sessionId?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonSecure({ success: false, error: "JSON inválido en la petición" }, { status: 400 });
  }

  if (body.action === "revoke" && body.id) {
    const ok = await revokeLauncherUser(body.id, ip);
    return jsonSecure({ success: ok }, { status: ok ? 200 : 404 });
  }

  if (body.action === "delete" && body.id) {
    const result = await deleteLauncherUser(body.id, ip);
    return jsonSecure(result, { status: result.success ? 200 : 400 });
  }

  if (body.action === "restore" && body.id) {
    const ok = await restoreLauncherUser(body.id, ip);
    return jsonSecure({ success: ok }, { status: ok ? 200 : 404 });
  }

  if (body.action === "revoke-sessions" && (body.userId || body.id)) {
    const count = await revokeSessionsForUser(body.userId ?? body.id!, ip);
    return jsonSecure({ success: count > 0, count }, { status: 200 });
  }

  if (body.action === "revoke-session" && body.sessionId) {
    const ok = await revokeSession(body.sessionId, ip);
    return jsonSecure({ success: ok }, { status: ok ? 200 : 404 });
  }

  if (body.action === "update" && body.id) {
    const tier = body.tier ? normalizeProfilePlan(body.tier) : undefined;
    const updated = await updateLauncherUser(
      body.id,
      {
        displayName: body.displayName,
        tier,
        email: body.email,
        notes: body.notes,
        referralCode: body.referralCode,
      },
      ip
    );
    if ("error" in updated) {
      return jsonSecure({ success: false, error: updated.error }, { status: 400 });
    }
    return jsonSecure({ success: true, user: updated }, { status: 200 });
  }

  if (body.action === "reset-password" && body.id) {
    if (!body.password) {
      return jsonSecure({ success: false, error: "Contraseña requerida" }, { status: 400 });
    }
    const result = await resetLauncherUserPassword(body.id, body.password, ip);
    return jsonSecure(result, { status: result.success ? 200 : 400 });
  }

  if (!body.username?.trim() || !body.password) {
    return jsonSecure({ success: false, error: "Usuario y contraseña requeridos" }, { status: 400 });
  }

  const tier = normalizeProfilePlan(body.tier);
  const temporaryMinutes =
    typeof body.temporaryMinutes === "number" && body.temporaryMinutes > 0
      ? Math.min(Math.max(Math.floor(body.temporaryMinutes), 15), 60 * 24 * 30)
      : undefined;
  const singleUse = Boolean(body.singleUse);

  const created = await createLauncherUser(
    body.username,
    body.password,
    tier,
    body.displayName,
    ip,
    {
      email: body.email,
      notes: body.notes,
      referralCode: body.referralCode,
      temporaryMinutes,
      singleUse,
    }
  );

  if ("error" in created) {
    return jsonSecure({ success: false, error: created.error }, { status: 400 });
  }

  return jsonSecure({ success: true, user: created }, { status: 201 });
  } catch (err) {
    console.error("[profiles POST]", err);
    return jsonSecure({ success: false, error: apiErrorMessage(err) }, { status: 500 });
  }
}
