import {
  assertAdminSession,
  clientIp,
  isSameOriginAdminRequest,
  jsonSecure,
} from "@/lib/launcher-auth/http";
import {
  revokeLauncherUser,
  revokeSession,
  revokeSessionsForUser,
} from "@/lib/launcher-auth/service";
import { createNotification } from "@/lib/launcher-notifications/service";
import {
  enqueueCommand,
  findPresenceBySessionId,
  listLiveSessions,
  removePresenceByDevice,
} from "@/lib/live-ops/service";

export async function GET() {
  const authenticated = await assertAdminSession();
  const sessions = authenticated ? await listLiveSessions() : [];
  const stats = {
    total: sessions.length,
    playing: sessions.filter((s) => s.status === "playing").length,
    countries: new Set(sessions.map((s) => s.countryCode)).size,
    alerts: sessions.filter((s) => s.health !== "healthy").length,
  };
  return jsonSecure({ authenticated, sessions, stats });
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
    sessionId?: string;
    payload?: { message?: string };
  };

  if (!body.sessionId || !body.action) {
    return jsonSecure({ error: "action y sessionId requeridos" }, { status: 400 });
  }

  const presence = findPresenceBySessionId(body.sessionId);
  if (!presence) {
    return jsonSecure({ error: "Sesión no encontrada o sin conexión reciente" }, { status: 404 });
  }

  if (body.action === "message") {
    const message = body.payload?.message?.trim();
    if (!message) {
      return jsonSecure({ error: "Mensaje requerido" }, { status: 400 });
    }
    await createNotification({
      title: "Mensaje del admin",
      message,
      style: "info",
      display: "alert",
      target: "specific",
      targetDevices: [presence.deviceId],
    });
    await enqueueCommand(
      presence.deviceId,
      {
        type: "notification",
        title: "Mensaje del admin",
        message,
        style: "info",
        display: "alert",
      },
      presence.id
    );
    return jsonSecure({ success: true, message: "Mensaje enviado" });
  }

  if (body.action === "restart") {
    await enqueueCommand(presence.deviceId, { type: "restart" }, presence.id);
    return jsonSecure({ success: true, message: "Reinicio encolado" });
  }

  if (body.action === "kill_game") {
    await enqueueCommand(presence.deviceId, { type: "kill_game" }, presence.id);
    return jsonSecure({ success: true, message: "Cierre de Minecraft encolado" });
  }

  if (body.action === "ban") {
    if (presence.userId) {
      await revokeSessionsForUser(presence.userId, ip);
      await revokeLauncherUser(presence.userId, ip);
    }
    await revokeSession(presence.id, ip);
    await removePresenceByDevice(presence.deviceId);
    return jsonSecure({
      success: true,
      message: presence.userId
        ? "Usuario baneado y sesiones revocadas"
        : "Sesión revocada y desconectada",
    });
  }

  return jsonSecure({ error: "Acción desconocida" }, { status: 400 });
}
