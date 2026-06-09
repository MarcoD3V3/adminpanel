import fs from "node:fs";
import path from "node:path";

export function forgeInstallerUrl(mcVersion, forgeVersion) {
  const id = `${mcVersion}-${forgeVersion}`;
  return `https://maven.minecraftforge.net/net/minecraftforge/forge/${id}/forge-${id}-installer.jar`;
}

export async function ensureForgeInstaller(root, mcVersion, forgeVersion, onProgress) {
  const id = `${mcVersion}-${forgeVersion}`;
  const dir = path.join(root, "forge-installers");
  const file = path.join(dir, `forge-${id}-installer.jar`);

  if (fs.existsSync(file)) {
    const size = fs.statSync(file).size;
    if (size > 50_000) return file;
    fs.unlinkSync(file);
  }

  fs.mkdirSync(dir, { recursive: true });
  const url = forgeInstallerUrl(mcVersion, forgeVersion);

  onProgress?.({ stage: "progress", message: `Descargando Forge ${id}…` });

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `No se pudo descargar Forge ${id} (${res.status}). Comprueba tu conexión a internet.`
    );
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 50_000) {
    throw new Error(`Forge installer corrupto o vacío (${id}).`);
  }

  fs.writeFileSync(file, buf);
  onProgress?.({
    stage: "log",
    message: `Forge installer guardado (${Math.round(buf.length / 1024)} KB)`,
  });

  return file;
}
