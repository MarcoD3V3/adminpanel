import path from "path";
import { getDataDir } from "@/lib/data-dir";

export const DEFAULT_MC_VERSION = "1.18.2";

export function normalizeMcVersionParam(raw: string | null | undefined): string {
  const v = String(raw ?? "").trim();
  return v || DEFAULT_MC_VERSION;
}

export function gameUiFileForVersion(mcVersion: string): string {
  return path.join(getDataDir(), "game-ui", `${normalizeMcVersionParam(mcVersion)}.json`);
}

export function loadingUiFileForVersion(mcVersion: string): string {
  return path.join(getDataDir(), "loading-ui", `${normalizeMcVersionParam(mcVersion)}.json`);
}

export function legacyGameUiFile(): string {
  return path.join(getDataDir(), "game-ui.json");
}

export function legacyLoadingUiFile(): string {
  return path.join(getDataDir(), "loading-ui.json");
}
