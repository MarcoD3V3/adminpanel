import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let cached = null;

function readBundledConfig() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, "app-config.json"), "utf-8");
    const parsed = JSON.parse(raw);
    const url = parsed?.adminApiUrl?.trim();
    return url ? url.replace(/\/$/, "") : null;
  } catch {
    return null;
  }
}

/** URL del panel admin (Railway en .exe distribuido, localhost en dev). */
export function getPanelBase() {
  if (cached) return cached;

  const fromEnv =
    process.env.CRAFTLAUNCHER_PANEL_URL?.trim() ||
    process.env.VITE_ADMIN_API_URL?.trim() ||
    readBundledConfig();

  cached = (fromEnv || "http://localhost:3000").replace(/\/$/, "");
  return cached;
}
