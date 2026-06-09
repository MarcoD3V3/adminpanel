"use client";

import { useEffect } from "react";
import { fetchMinecraftVersions } from "@/lib/minecraft-versions-client";

/** Precarga en segundo plano datos que casi no cambian (versiones MC). */
export function AdminWarmCache() {
  useEffect(() => {
    void fetchMinecraftVersions().catch(() => {});
  }, []);
  return null;
}
