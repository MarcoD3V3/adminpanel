/**
 * Libera release/ antes de electron-builder (Windows suele dejar app.asar bloqueado).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const launcherRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releaseDir = path.join(launcherRoot, "release-out");

if (process.platform === "win32") {
  for (const image of ["CraftLauncher.exe", "electron.exe"]) {
    spawnSync("taskkill", ["/F", "/IM", image, "/T"], { stdio: "ignore", shell: true });
  }
}

try {
  if (fs.existsSync(releaseDir)) {
    fs.rmSync(releaseDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 400 });
    console.info("[clean-release] Eliminado:", releaseDir);
  } else {
    console.info("[clean-release] Nada que limpiar.");
  }
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.warn("[clean-release] No se pudo borrar release/ (archivo en uso):", msg);
  console.warn("[clean-release] Cierra CraftLauncher, terminales con launcher:dev y la carpeta en el Explorador.");
}
