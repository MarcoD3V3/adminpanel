import { verifyRequestSession } from "@/lib/launcher-auth/service";
import {
  decodeSkinImageInput,
  deleteUserSkin,
  getSkinMeta,
  listSkinRegistry,
  readSkinPng,
  saveUserSkin,
  skinExists,
} from "@/lib/launcher-auth/skin-store";
import { loadAuthStore } from "@/lib/launcher-auth/store";
import { corsHeaders, jsonWithCors, optionsResponse } from "@/lib/launcher-auth/http";

export async function OPTIONS(request: Request) {
  return optionsResponse(request.headers.get("origin"));
}

async function resolveSession(request: Request) {
  const origin = request.headers.get("origin");
  const auth = request.headers.get("authorization");
  const deviceId = request.headers.get("x-device-id");
  const fingerprint = request.headers.get("x-device-fingerprint");
  const session = await verifyRequestSession(auth, deviceId, fingerprint);
  return { origin, session };
}

async function resolveUserId(session: Awaited<ReturnType<typeof verifyRequestSession>>) {
  if (!session.valid) return null;
  const store = await loadAuthStore();
  const live = store.sessions.find((s) => s.id === session.sessionId);
  return live?.userId ?? null;
}

export async function GET(request: Request) {
  const { origin, session } = await resolveSession(request);
  if (!session.valid) {
    return jsonWithCors({ error: "Sesión inválida" }, { status: 401 }, origin);
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action") ?? "mine";

  if (action === "registry") {
    const entries = await listSkinRegistry();
    return jsonWithCors({ entries }, { status: 200 }, origin);
  }

  if (action === "file") {
    const username = url.searchParams.get("username")?.trim().toLowerCase();
    if (!username) {
      return jsonWithCors({ error: "username requerido" }, { status: 400 }, origin);
    }
    const store = await loadAuthStore();
    const user = store.users.find((u) => u.username === username && !u.revoked);
    if (!user || !skinExists(user.id)) {
      return new Response(null, { status: 404, headers: corsHeaders(origin) });
    }
    const png = readSkinPng(user.id);
    if (!png) return new Response(null, { status: 404, headers: corsHeaders(origin) });
    const headers = new Headers(corsHeaders(origin));
    headers.set("Content-Type", "image/png");
    headers.set("Cache-Control", "private, max-age=60");
    return new Response(new Uint8Array(png), { status: 200, headers });
  }

  const userId = await resolveUserId(session);
  if (!userId) {
    return jsonWithCors(
      {
        hasSkin: false,
        requiresAccount: true,
        error: "Inicia sesión con tu cuenta para personalizar la skin",
      },
      { status: 403 },
      origin
    );
  }

  const meta = getSkinMeta(userId);
  const hasSkin = skinExists(userId);
  const includeImage = url.searchParams.get("include") === "image";

  if (includeImage && hasSkin) {
    const png = readSkinPng(userId);
    if (png) {
      const dataUrl = `data:image/png;base64,${png.toString("base64")}`;
      return jsonWithCors(
        {
          hasSkin: true,
          updatedAt: meta?.updatedAt ?? null,
          username: session.username ?? meta?.username ?? null,
          dataUrl,
        },
        { status: 200 },
        origin
      );
    }
  }

  return jsonWithCors(
    {
      hasSkin,
      updatedAt: meta?.updatedAt ?? null,
      username: session.username ?? meta?.username ?? null,
    },
    { status: 200 },
    origin
  );
}

export async function POST(request: Request) {
  const { origin, session } = await resolveSession(request);
  if (!session.valid) {
    return jsonWithCors({ success: false, error: "Sesión inválida" }, { status: 401 }, origin);
  }

  const userId = await resolveUserId(session);
  const username = session.username;
  if (!userId || !username) {
    return jsonWithCors(
      {
        success: false,
        error: "Solo cuentas con usuario y contraseña pueden subir skins. Usa inicio de sesión, no token.",
      },
      { status: 403 },
      origin
    );
  }

  let body: { image?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonWithCors({ success: false, error: "JSON inválido" }, { status: 400 }, origin);
  }

  const png = body.image ? decodeSkinImageInput(body.image) : null;
  if (!png?.length) {
    return jsonWithCors(
      { success: false, error: "No se pudo leer la imagen. Vuelve a seleccionar el PNG." },
      { status: 400 },
      origin
    );
  }

  const saved = await saveUserSkin(userId, username, png);
  if (!saved.ok) {
    return jsonWithCors({ success: false, error: saved.error }, { status: 400 }, origin);
  }

  return jsonWithCors(
    { success: true, updatedAt: saved.updatedAt, username },
    { status: 200 },
    origin
  );
}

export async function DELETE(request: Request) {
  const { origin, session } = await resolveSession(request);
  if (!session.valid) {
    return jsonWithCors({ success: false, error: "Sesión inválida" }, { status: 401 }, origin);
  }

  const userId = await resolveUserId(session);
  if (!userId) {
    return jsonWithCors({ success: false, error: "Cuenta requerida" }, { status: 403 }, origin);
  }

  await deleteUserSkin(userId);
  return jsonWithCors({ success: true }, { status: 200 }, origin);
}
