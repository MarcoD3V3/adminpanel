import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Todas las versiones MC del catálogo con proyecto de mod definido. */
export const MOD_CATALOG_MC_VERSIONS = [
  "1.21.1",
  "1.20.1",
  "1.19.2",
  "1.18.2",
  "1.16.5",
  "1.12.2",
];

function modJarPath(mcVersion) {
  const jarName = `craftlauncher-client-${mcVersion}.jar`;
  const roots = [
    path.join(__dirname, "..", "assets", "mods"),
    path.join(__dirname, "..", "assets", "client-patches", mcVersion),
  ];
  for (const root of roots) {
    const full = path.join(root, jarName);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

/** true si hay JAR compilado listo para instalar en esa versión. */
export function isModJarBuiltForVersion(mcVersion) {
  const v = String(mcVersion ?? "").trim();
  if (!MOD_CATALOG_MC_VERSIONS.includes(v)) return false;
  const jar = modJarPath(v);
  if (!jar) return false;
  const metaPath = `${jar}.meta.json`;
  if (!fs.existsSync(metaPath)) return true;
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
    return String(meta.mcVersion ?? "").trim() === v;
  } catch {
    return true;
  }
}

/** Versiones con soporte de mod (catálogo). La instalación requiere JAR compilado. */
export function isModSupportedForVersion(mcVersion) {
  return MOD_CATALOG_MC_VERSIONS.includes(String(mcVersion ?? "").trim());
}
