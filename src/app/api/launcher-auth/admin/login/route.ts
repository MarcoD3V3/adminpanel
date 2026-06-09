import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
  createAdminSessionValue,
  isAdminSecretConfigured,
  verifyAdminSecret,
} from "@/lib/launcher-auth/admin-session";
import { appendAuditLog } from "@/lib/launcher-auth/audit";
import { clientIp, isSameOriginAdminRequest, jsonSecure } from "@/lib/launcher-auth/http";
import { checkRateLimit } from "@/lib/launcher-auth/rate-limit";

export async function POST(request: Request) {
  if (!isSameOriginAdminRequest(request)) {
    return jsonSecure({ error: "Origen no permitido" }, { status: 403 });
  }

  const ip = clientIp(request);
  const rateKey = `admin_login:${ip}`;
  if (!checkRateLimit(rateKey, 5, 15 * 60 * 1000)) {
    return jsonSecure({ error: "Demasiados intentos. Espera 15 minutos." }, { status: 429 });
  }

  if (!isAdminSecretConfigured()) {
    return jsonSecure(
      {
        error: "LAUNCHER_ADMIN_SECRET no configurado (mín. 16 caracteres en .env.local).",
      },
      { status: 503 }
    );
  }

  const body = (await request.json()) as { key?: string; remember?: boolean };
  if (!verifyAdminSecret(body.key ?? null)) {
    await appendAuditLog("admin_login_failed", ip);
    return jsonSecure({ error: "Clave incorrecta" }, { status: 401 });
  }

  const remember = body.remember !== false;
  const sessionValue = createAdminSessionValue(remember);
  if (!sessionValue) {
    return jsonSecure({ error: "No se pudo iniciar sesión" }, { status: 500 });
  }

  await appendAuditLog("admin_login", ip);
  const res = jsonSecure({ success: true, remember });
  res.cookies.set(ADMIN_SESSION_COOKIE, sessionValue, adminSessionCookieOptions(remember));
  return res;
}

export async function DELETE() {
  const res = jsonSecure({ success: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, "", { ...adminSessionCookieOptions(), maxAge: 0 });
  return res;
}
