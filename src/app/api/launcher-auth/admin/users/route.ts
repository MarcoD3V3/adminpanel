import {
  createLauncherUser,
  listLauncherUsers,
  resetLauncherUserPassword,
  revokeLauncherUser,
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
  const users = authenticated ? await listLauncherUsers() : [];
  return jsonSecure({ authenticated, users });
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
    username?: string;
    password?: string;
    displayName?: string;
    tier?: string;
  };

  if (body.action === "revoke" && body.id) {
    const ok = await revokeLauncherUser(body.id, ip);
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
    if (!body.password) return jsonSecure({ success: false, error: "Contraseña requerida" }, { status: 400 });
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
