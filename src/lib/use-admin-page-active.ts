"use client";

import { usePathname } from "next/navigation";
import type { AdminRoute } from "@/lib/page-registry-types";

/** True solo cuando esta ruta admin es la visible (evita efectos en páginas ocultas). */
export function useAdminPageActive(route: AdminRoute): boolean {
  const pathname = usePathname();
  return pathname === route;
}
