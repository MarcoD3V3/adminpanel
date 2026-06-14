#!/usr/bin/env node
/**
 * Escribe electron/app-config.json con la URL del admin para el .exe instalado.
 * Lee VITE_ADMIN_API_URL desde .env.local de la raíz del monorepo.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../../..");
const out = path.join(__dirname, "../electron/app-config.json");

function parseEnvFile(file) {
  const vars = {};
  if (!fs.existsSync(file)) return vars;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    vars[key] = val;
  }
  return vars;
}

const env = {
  ...parseEnvFile(path.join(root, ".env")),
  ...parseEnvFile(path.join(root, ".env.local")),
};

const adminApiUrl =
  process.env.VITE_ADMIN_API_URL?.trim() ||
  env.VITE_ADMIN_API_URL?.trim() ||
  process.env.CRAFTLAUNCHER_PANEL_URL?.trim() ||
  env.CRAFTLAUNCHER_PANEL_URL?.trim() ||
  "";

const payload = {
  adminApiUrl: adminApiUrl.replace(/\/$/, ""),
  generatedAt: new Date().toISOString(),
};

fs.writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
console.log(
  adminApiUrl
    ? `[CraftLauncher] app-config.json → ${adminApiUrl}`
    : "[CraftLauncher] app-config.json sin adminApiUrl — el .exe usará localhost:3000"
);
