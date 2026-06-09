import {
  createLauncherUser,
  getAdminProfilesOverview,
  listAuditLog,
  resetLauncherUserPassword,
  restoreLauncherUser,
  revokeLauncherUser,
  revokeSession,
  revokeSessionsForUser,
  updateLauncherUser,
} from "@/lib/launcher-auth/service";
import {
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

  const [{ users, sessions }, auditLog] = await Promise.all([
    getAdminProfilesOverview(),
    listAuditLog(30),
  ]);

  const stats = {
    totalUsers: users.length,
    activeUsers: users.filter((u) => !u.revoked).length,
    revokedUsers: users.filter((u) => u.revoked).length,
    activeSessions: sessions.filter((s) => !s.revoked && Date.parse(s.expiresAt) > Date.now()).length,
    usersWithSkin: users.filter((u) => u.hasSkin).length,
  };

  return jsonSecure({ authenticated: true, users, sessions, auditLog, stats });
}

export async function POST(request: Request) {
  if (!isSameOriginAdminRequest(request)) {
    return jsonSecure({ error: "Origen no permitido" }, { status: 403 });
  }
  if (!(await assertAdminSession())) {
    return jsonSecure({ error: "Sesión admin requerida" }, { status: 401 });
  }

  const ip = clientIp(request);
  const body = (await request.json()) as {
    action?: string;
    id?: string;
    userId?: string;
    username?: string;
    password?: string;
    displayName?: string;
    tier?: string;
    sessionId?: string;
  };

  if (body.action === "revoke" && body.id) {
    const ok = await revokeLauncherUser(body.id, ip);
    return jsonSecure({ success: ok }, { status: ok ? 200 : 404 });
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
    const tier = body.tier === "premium" ? "premium" : body.tier === "free" ? "free" : undefined;
    const updated = await updateLauncherUser(
      body.id,
      { displayName: body.displayName, tier },
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
    return jsonSecure({ error: "Usuario y contraseña requeridos" }, { status: 400 });
  }

  const tier = body.tier === "premium" ? "premium" : "free";
  const created = await createLauncherUser(
    body.username,
    body.password,
    tier,
    body.displayName,
    ip
  );

  if ("error" in created) {
    return jsonSecure({ success: false, error: created.error }, { status: 400 });
  }

  return jsonSecure({ success: true, user: created }, { status: 201 });
}
