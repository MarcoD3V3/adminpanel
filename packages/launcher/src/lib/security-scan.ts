import { reportLauncherSecurity } from "@craftlauncher/shared";
import { getSessionAuthApiUrl } from "./auth-api";
import { useAuthStore } from "./auth-store";

let lastScanAt = 0;

export async function runLauncherSecurityScan(): Promise<void> {
  if (Date.now() - lastScanAt < 60_000) return;
  lastScanAt = Date.now();

  if (useAuthStore.getState().status !== "ready") return;
  const headers = await useAuthStore.getState().resolveHeaders(true);
  if (!headers) return;

  const api = getSessionAuthApiUrl();

  if (typeof navigator !== "undefined" && navigator.webdriver) {
    await reportLauncherSecurity(api, headers, {
      type: "launcher_bot_automation",
      detail: "navigator.webdriver activo en el launcher",
    });
  }

  if (typeof window !== "undefined") {
    const tamperedKeys = ["__craft_override", "admin_bypass", "cheat_enabled"];
    for (const key of tamperedKeys) {
      if (localStorage.getItem(key) || sessionStorage.getItem(key)) {
        await reportLauncherSecurity(api, headers, {
          type: "launcher_env_tamper",
          detail: `Almacenamiento local con clave sospechosa: ${key}`,
        });
      }
    }

    if (window.outerWidth - window.innerWidth > 160 || window.outerHeight - window.innerHeight > 160) {
      await reportLauncherSecurity(api, headers, {
        type: "launcher_debugger_attached",
        detail: "Ventana con dimensiones de DevTools detectadas",
      });
    }
  }

  if (import.meta.env.DEV) return;

  const envFlags = [
    import.meta.env.VITE_INSECURE_SSL,
    import.meta.env.VITE_DISABLE_TLS,
  ].filter(Boolean);
  if (envFlags.length) {
    await reportLauncherSecurity(api, headers, {
      type: "launcher_ssl_pin_bypass",
      detail: "Variables de entorno que debilitan TLS en el launcher",
      metadata: { flags: envFlags.length },
    });
  }
}
