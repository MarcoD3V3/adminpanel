"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { PageLoader } from "@/components/layout/PageLoader";
import type { AdminRoute } from "@/lib/page-registry-types";

function chunkLoadFallback(label: string): { default: ComponentType } {
  const Fallback = () => (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-8">
      <p className="text-sm text-[var(--color-danger-text)]">No se pudo cargar {label}.</p>
      <button
        type="button"
        className="text-sm text-[var(--color-accent)] underline"
        onClick={() => window.location.reload()}
      >
        Recargar página
      </button>
    </div>
  );
  return { default: Fallback };
}

function lazyPage(label: string, loader: () => Promise<{ default: ComponentType }>) {
  return dynamic(
    () =>
      loader().catch((reason) => {
        console.error(`[CraftLauncher] error cargando "${label}":`, reason);
        return chunkLoadFallback(label);
      }),
    {
      loading: () => <PageLoader label={label} />,
      ssr: false,
    }
  );
}

/** Cada ruta en su propio chunk — no cargar Hub Builder / Studio en el layout inicial. */
export const PAGE_REGISTRY: Record<AdminRoute, ComponentType> = {
  "/": lazyPage("panel", () => import("@/views/dashboard")),
  "/live-ops": lazyPage("Live Ops", () => import("@/views/live-ops")),
  "/analytics": lazyPage("analíticas", () => import("@/views/analytics")),
  "/users": lazyPage("usuarios", () => import("@/views/users")),
  "/profiles": lazyPage("perfiles", () => import("@/views/profiles")),
  "/launchers": lazyPage("launchers", () => import("@/views/launchers")),
  "/launcher-access": lazyPage("acceso", () => import("@/views/launcher-access")),
  "/notifications": lazyPage("notificaciones", () => import("@/views/notifications")),
  "/events": lazyPage("eventos", () => import("@/views/events")),
  "/scheduler": lazyPage("programador", () => import("@/views/scheduler")),
  "/chat": lazyPage("chat", () => import("@/views/chat")),
  "/studio": lazyPage("studio", () => import("@/views/studio")),
  "/hub-builder": lazyPage("Hub Builder", () => import("@/views/hub-builder")),
  "/game-ui": lazyPage("UI del juego", () => import("@/views/game-ui")),
  "/modpacks": lazyPage("modpacks", () => import("@/views/modpacks")),
  "/missions": lazyPage("misiones", () => import("@/views/missions")),
  "/automation": lazyPage("automatización", () => import("@/views/automation")),
  "/rewards": lazyPage("recompensas", () => import("@/views/rewards")),
  "/experiments": lazyPage("experimentos", () => import("@/views/experiments")),
  "/security": lazyPage("seguridad", () => import("@/views/security")),
  "/integrations": lazyPage("integraciones", () => import("@/views/integrations")),
  "/versions": lazyPage("versiones", () => import("@/views/versions")),
  "/settings": lazyPage("configuración", () => import("@/views/settings")),
};

export type { AdminRoute } from "@/lib/page-registry-types";
export { ADMIN_ROUTES, isAdminRoute } from "@/lib/page-registry-types";
