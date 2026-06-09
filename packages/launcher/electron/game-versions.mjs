import fs from "node:fs";
import path from "node:path";
import { instanceGameRoot, resolveDataDir } from "./launcher-paths.mjs";
import { loadSettings } from "./launcher-settings.mjs";

function readVersionIdsFromGameRoot(gameRoot) {
  const versionsDir = path.join(gameRoot, "versions");
  if (!fs.existsSync(versionsDir)) return [];
  return fs
    .readdirSync(versionsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((id) => fs.existsSync(path.join(versionsDir, id, `${id}.json`)));
}

function formatVersionLabel(id) {
  const s = String(id);
  if (/forge/i.test(s)) {
    return s.replace(/-/g, " · ").replace(/forge/gi, "Forge");
  }
  return s;
}

/** Versiones con JSON en `instances/<id>/game/versions`. */
export function listInstalledGameVersions(instanceId) {
  const dataDir = resolveDataDir();
  const settings = loadSettings();
  const id = instanceId ?? settings.activeInstanceId;
  if (!id) return [];

  const gameRoot = instanceGameRoot(dataDir, id);
  const ids = [...new Set(readVersionIdsFromGameRoot(gameRoot))].sort((a, b) =>
    b.localeCompare(a, undefined, { numeric: true })
  );

  return ids.map((vid) => ({ id: vid, label: formatVersionLabel(vid) }));
}
