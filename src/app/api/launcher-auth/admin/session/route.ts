import {
  isAdminSecretConfigured,
  usesDevAdminFallback,
} from "@/lib/launcher-auth/admin-session";
import { assertAdminSession, jsonSecure } from "@/lib/launcher-auth/http";

export async function GET() {
  const authenticated = await assertAdminSession();
  return jsonSecure({
    authenticated,
    configured: isAdminSecretConfigured(),
    devFallbackActive: !authenticated && usesDevAdminFallback(),
  });
}
