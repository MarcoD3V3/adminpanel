import type { CurseForgeModFile } from "@craftlauncher/shared";
import type { InstalledModRow } from "./electron-api";

export type ModInstallStatus =
  | { state: "none" }
  | { state: "installed"; row: InstalledModRow }
  | { state: "update"; row: InstalledModRow };

function normalizeJarName(name: string) {
  const base = name.trim().replace(/\.disabled$/i, "");
  if (!base) return "";
  return base.toLowerCase().endsWith(".jar") ? base : `${base}.jar`;
}

function fileNameMatchesPreview(installedName: string, previewFiles: CurseForgeModFile[]) {
  const normalized = normalizeJarName(installedName).toLowerCase();
  return previewFiles.some((f) => {
    const candidates = [f.fileName, normalizeJarName(f.fileName)];
    return candidates.some((c) => c.toLowerCase() === normalized);
  });
}

function activeInstalledMods(installedMods: InstalledModRow[]) {
  return installedMods.filter((r) => !r.disabled);
}

export function resolveModInstallStatus(
  modId: number,
  installedMods: InstalledModRow[],
  previewFiles: CurseForgeModFile[] = []
): ModInstallStatus {
  const rows = activeInstalledMods(installedMods);
  const byId = rows.find((r) => r.modId === modId);
  if (byId) {
    return byId.updateAvailable ? { state: "update", row: byId } : { state: "installed", row: byId };
  }

  if (previewFiles.length) {
    const byFile = rows.find((r) => fileNameMatchesPreview(r.fileName, previewFiles));
    if (byFile) {
      return byFile.updateAvailable ? { state: "update", row: byFile } : { state: "installed", row: byFile };
    }
  }

  return { state: "none" };
}

export function modInstallBadge(
  modId: number,
  installedMods: InstalledModRow[]
): "installed" | "update" | null {
  const status = resolveModInstallStatus(modId, installedMods);
  if (status.state === "update") return "update";
  if (status.state === "installed") return "installed";
  return null;
}
