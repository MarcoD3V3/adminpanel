import { getLauncherApi } from "@/lib/electron-api";
import { useLauncherDataStore } from "@/lib/launcher-data-store";

let bootstrapped = false;

export function ensureModsBootstrapped() {
  if (bootstrapped) return;
  bootstrapped = true;
  void useLauncherDataStore.getState().bootstrap();
  void useLauncherDataStore.getState().loadFeaturedModpacks();
  // Warm up CurseForge key status in background (optional).
  void getLauncherApi()?.curseForgeStatus?.();
}

