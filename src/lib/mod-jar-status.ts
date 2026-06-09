import fs from "node:fs";
import path from "node:path";

const MOD_CATALOG = ["1.21.1", "1.20.1", "1.19.2", "1.18.2", "1.16.5", "1.12.2"] as const;

function assetsModsDir() {
  return path.join(process.cwd(), "packages", "launcher", "assets", "mods");
}

/** true si el JAR del mod está compilado y listo para esa versión MC. */
export function isModJarBuilt(mcVersion: string): boolean {
  const v = mcVersion.trim();
  if (!MOD_CATALOG.includes(v as (typeof MOD_CATALOG)[number])) return false;
  const jar = path.join(assetsModsDir(), `craftlauncher-client-${v}.jar`);
  if (!fs.existsSync(jar)) return false;
  const metaPath = `${jar}.meta.json`;
  if (!fs.existsSync(metaPath)) return true;
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8")) as { mcVersion?: string };
    return String(meta.mcVersion ?? "").trim() === v;
  } catch {
    return true;
  }
}

export function applyModBuiltFlags<T extends { mcVersion: string; modBuilt: boolean }>(profiles: T[]): T[] {
  return profiles.map((p) => ({ ...p, modBuilt: isModJarBuilt(p.mcVersion) }));
}
