import { isTesterModeEnabled, setTesterModeEnabled } from "@/lib/launcher-auth/access-settings";
import {
  assertAdminSession,
  clientIp,
  isSameOriginAdminRequest,
  jsonSecure,
  jsonWithCors,
  optionsResponse,
} from "@/lib/launcher-auth/http";

export async function OPTIONS(request: Request) {
  return optionsResponse(request.headers.get("origin"));
}

/** Público (launcher): consulta si el modo testeo está activo. */
export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  const testerModeEnabled = await isTesterModeEnabled();
  return jsonWithCors({ testerModeEnabled }, { status: 200 }, origin);
}

/** Admin: activar / desactivar modo testeo. */
export async function PUT(request: Request) {
  if (!isSameOriginAdminRequest(request)) {
    return jsonSecure({ success: false, error: "Origen no permitido" }, { status: 403 });
  }
  if (!(await assertAdminSession())) {
    return jsonSecure({ success: false, error: "Sesión admin requerida" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { enabled?: boolean };
  if (typeof body.enabled !== "boolean") {
    return jsonSecure({ success: false, error: "Campo enabled requerido" }, { status: 400 });
  }

  const testerModeEnabled = await setTesterModeEnabled(body.enabled, clientIp(request));
  return jsonSecure({ success: true, testerModeEnabled });
}
