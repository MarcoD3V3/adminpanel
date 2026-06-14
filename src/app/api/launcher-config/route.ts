import { getPublicLauncherConfig } from "@/lib/settings/service";
import { jsonWithCors, optionsResponse } from "@/lib/launcher-auth/http";

export async function OPTIONS(request: Request) {
  return optionsResponse(request.headers.get("origin"));
}

/** Config pública para el launcher (sin secretos). */
export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  const config = await getPublicLauncherConfig();
  return jsonWithCors({ config }, { status: 200 }, origin);
}
