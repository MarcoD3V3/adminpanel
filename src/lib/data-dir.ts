import path from "node:path";

/**
 * Directorio persistente del admin (perfiles, hub, skins…).
 * En Railway: monta un volumen en `/app/data` — se usa RAILWAY_VOLUME_MOUNT_PATH automáticamente.
 */
export function getDataDir(): string {
  const explicit = process.env.CRAFTLAUNCHER_DATA_DIR?.trim();
  if (explicit) return explicit;

  const railwayMount = process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim();
  if (railwayMount) return railwayMount;

  return path.join(process.cwd(), "data");
}

export function dataPath(...segments: string[]): string {
  return path.join(getDataDir(), ...segments);
}
