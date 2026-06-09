import { appendAuditLog } from "@/lib/launcher-auth/audit";
import { loadAuthStore } from "@/lib/launcher-auth/store";
import {
  assertAdminSession,
  clientIp,
  isSameOriginAdminRequest,
  jsonSecure,
} from "@/lib/launcher-auth/http";
import {
  decodeSkinImageInput,
  deleteUserSkin,
  getSkinMeta,
  listSkinRegistry,
  readSkinPng,
  saveUserSkin,
  skinExists,
} from "@/lib/launcher-auth/skin-store";
import { isValidRecordId } from "@/lib/launcher-auth/validation";

export async function GET(request: Request) {
  const authenticated = await assertAdminSession();
  if (!authenticated) {
    return jsonSecure({ authenticated: false, entries: [] }, { status: 401 });
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  const include = url.searchParams.get("include");

  if (userId) {
    if (!isValidRecordId(userId)) {
      return jsonSecure({ error: "userId inválido" }, { status: 400 });
    }
    const meta = getSkinMeta(userId);
    const hasSkin = skinExists(userId);
    const payload: Record<string, unknown> = {
      userId,
      hasSkin,
      updatedAt: meta?.updatedAt ?? null,
      username: meta?.username ?? null,
    };
    if (include === "image" && hasSkin) {
      const png = readSkinPng(userId);
      if (png) payload.dataUrl = `data:image/png;base64,${png.toString("base64")}`;
    }
    return jsonSecure(payload);
  }

  const entries = await listSkinRegistry();
  return jsonSecure({ authenticated: true, entries });
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
    userId?: string;
    image?: string;
  };

  if (body.action === "delete" && body.userId) {
    if (!isValidRecordId(body.userId)) {
      return jsonSecure({ success: false, error: "userId inválido" }, { status: 400 });
    }
    const removed = await deleteUserSkin(body.userId);
    if (removed) await appendAuditLog("skin_deleted_admin", ip, body.userId);
    return jsonSecure({ success: removed }, { status: removed ? 200 : 404 });
  }

  if (!body.userId || !body.image) {
    return jsonSecure({ error: "userId e image requeridos" }, { status: 400 });
  }
  if (!isValidRecordId(body.userId)) {
    return jsonSecure({ error: "userId inválido" }, { status: 400 });
  }

  const store = await loadAuthStore();
  const user = store.users.find((u) => u.id === body.userId && !u.revoked);
  if (!user) {
    return jsonSecure({ error: "Usuario no encontrado o revocado" }, { status: 404 });
  }

  const png = decodeSkinImageInput(body.image);
  if (!png) {
    return jsonSecure({ error: "Imagen PNG inválida" }, { status: 400 });
  }

  const saved = await saveUserSkin(user.id, user.username, png);
  if (!saved.ok) {
    return jsonSecure({ success: false, error: saved.error }, { status: 400 });
  }

  await appendAuditLog("skin_uploaded_admin", ip, user.username);
  return jsonSecure({
    success: true,
    updatedAt: saved.updatedAt,
    username: user.username,
  });
}
