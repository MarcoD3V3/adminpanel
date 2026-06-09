import path from "path";

export const DEFAULT_MC_VERSION = "1.18.2";

export function normalizeMcVersionParam(raw: string | null | undefined): string {
  const v = String(raw ?? "").trim();
  return v || DEFAULT_MC_VERSION;
}

export function gameUiFileForVersion(cwd: string, mcVersion: string): string {
  return path.join(cwd, "data", "game-ui", `${normalizeMcVersionParam(mcVersion)}.json`);
}

export function loadingUiFileForVersion(cwd: string, mcVersion: string): string {
  return path.join(cwd, "data", "loading-ui", `${normalizeMcVersionParam(mcVersion)}.json`);
}

export function legacyGameUiFile(cwd: string): string {
  return path.join(cwd, "data", "game-ui.json");
}

export function legacyLoadingUiFile(cwd: string): string {
  return path.join(cwd, "data", "loading-ui.json");
}
