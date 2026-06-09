import fs from "node:fs";
import { instanceDir, instancesRoot } from "./launcher-paths.mjs";

const UUID_FOLDER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Nombre de carpeta legible: nombre del perfil o versión de Minecraft (ej. prueba-1, 1-12-2). */
export function slugifyInstanceFolder(name, mcVersion) {
  const base = String(name ?? mcVersion ?? "instancia")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  let slug = base
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) slug = String(mcVersion ?? "instancia").replace(/\./g, "-");
  return slug.slice(0, 56);
}

export function isLegacyUuidFolder(folderName) {
  return UUID_FOLDER.test(folderName);
}

export function resolveUniqueInstanceSlug(dataDir, name, mcVersion, exceptFolder = null) {
  const slug = slugifyInstanceFolder(name, mcVersion);
  let candidate = slug;
  let n = 2;

  while (true) {
    const dir = instanceDir(dataDir, candidate);
    if (!fs.existsSync(dir) || candidate === exceptFolder) return candidate;
    candidate = `${slug}-${n}`;
    n += 1;
  }
}

export function listInstanceFolderNames(dataDir) {
  const root = instancesRoot(dataDir);
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}
