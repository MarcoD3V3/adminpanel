import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSettings } from "./launcher-settings.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACK_ID = "craftlauncher-clean";
const PACK_ENTRY = `file/${PACK_ID}`;

/** pack_format por versión MC (evita pack incompatible en 1.16.5, etc.). */
const PACK_FORMAT_BY_MC = {
  "1.12.2": 3,
  "1.16.5": 6,
  "1.18.2": 8,
  "1.19.2": 9,
  "1.20.1": 15,
  "1.21.1": 34,
};

function packFormatFor(mcVersion) {
  return PACK_FORMAT_BY_MC[String(mcVersion ?? "").trim()] ?? 8;
}

function packAssetsRoot() {
  return path.join(__dirname, "..", "assets", "resourcepacks", PACK_ID);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

/** Inserta el pack en la lista resourcePacks de options.txt (sin duplicar). */
function activateInOptions(gameRoot) {
  const optionsFile = path.join(gameRoot, "options.txt");
  const line = `resourcePacks:["vanilla","${PACK_ENTRY}"]`;

  if (!fs.existsSync(optionsFile)) {
    fs.writeFileSync(optionsFile, `${line}\n`, "utf-8");
    return;
  }

  const content = fs.readFileSync(optionsFile, "utf-8");
  const lines = content.split(/\r?\n/);
  let found = false;

  const next = lines.map((l) => {
    if (!l.startsWith("resourcePacks:")) return l;
    found = true;
    if (l.includes(PACK_ENTRY)) return l;
    // Insertar el pack al final de la lista existente
    const m = l.match(/^resourcePacks:\[(.*)\]\s*$/);
    if (!m) return line;
    const inner = m[1].trim();
    const items = inner.length ? inner.split(",").map((s) => s.trim()) : [];
    if (!items.some((s) => s.includes("vanilla"))) items.unshift('"vanilla"');
    items.push(`"${PACK_ENTRY}"`);
    return `resourcePacks:[${items.join(",")}]`;
  });

  const result = found ? next.join("\n") : `${content.replace(/\s*$/, "")}\n${line}\n`;
  fs.writeFileSync(optionsFile, result, "utf-8");
}

function writePackMcmeta(destRoot, mcVersion) {
  const meta = {
    pack: {
      pack_format: packFormatFor(mcVersion),
      description: "CraftLauncher · UI limpia",
    },
  };
  fs.writeFileSync(path.join(destRoot, "pack.mcmeta"), JSON.stringify(meta, null, 2), "utf-8");
}

/** Repara pack.mcmeta y comprueba que el pack instalado sea válido para la versión MC. */
export function verifyStylePack(gameRoot, mcVersion) {
  const warnings = [];
  const errors = [];
  const packDir = path.join(gameRoot, "resourcepacks", PACK_ID);
  const mcmetaPath = path.join(packDir, "pack.mcmeta");

  if (!fs.existsSync(packDir)) {
    warnings.push("Pack de estilos no instalado — botones pueden verse vanilla.");
    return { ok: true, warnings, errors, applied: false, repaired: false };
  }

  const expectedFormat = packFormatFor(mcVersion);
  let repaired = false;

  try {
    let meta = { pack: { pack_format: expectedFormat, description: "CraftLauncher · UI limpia" } };
    if (fs.existsSync(mcmetaPath)) {
      try {
        meta = JSON.parse(fs.readFileSync(mcmetaPath, "utf-8"));
      } catch {
        warnings.push("pack.mcmeta corrupto — se regenerará.");
      }
    } else {
      warnings.push("pack.mcmeta faltante — se creará automáticamente.");
    }

    const current = meta?.pack?.pack_format;
    if (current !== expectedFormat) {
      meta.pack = { ...(meta.pack ?? {}), pack_format: expectedFormat };
      repaired = true;
      warnings.push(`pack_format ajustado a ${expectedFormat} para Minecraft ${mcVersion}.`);
    }

    if (!meta.pack?.description) {
      meta.pack = { ...(meta.pack ?? {}), description: "CraftLauncher · UI limpia" };
      repaired = true;
    }

    if (repaired || !fs.existsSync(mcmetaPath)) {
      fs.writeFileSync(mcmetaPath, JSON.stringify(meta, null, 2), "utf-8");
    }
  } catch (e) {
    errors.push(`No se pudo reparar el pack de estilos: ${e instanceof Error ? e.message : String(e)}`);
    return { ok: false, warnings, errors, applied: true, repaired: false };
  }

  const assetsDir = path.join(packDir, "assets");
  if (!fs.existsSync(assetsDir)) {
    warnings.push("El pack no tiene carpeta assets/ — estilos personalizados limitados.");
  }

  return { ok: true, warnings, errors, applied: true, repaired, packDir };
}

/** Copia y activa el resource pack de UI limpia antes de lanzar. */
export function applyUiPack({ gameRoot, mcVersion, onProgress }) {
  const settings = loadSettings();
  const cfg = settings.uiPack ?? {};
  if (cfg.enabled === false) return { applied: false, reason: "disabled" };

  const src = packAssetsRoot();
  if (!fs.existsSync(src)) {
    onProgress?.({
      stage: "install-log",
      level: "info",
      message: "Estilo de botones",
      detail: "Pack no generado — ejecuta: npm run build:button-pack",
    });
    return { applied: false, reason: "pack-missing" };
  }

  const dest = path.join(gameRoot, "resourcepacks", PACK_ID);
  copyDir(src, dest);
  writePackMcmeta(dest, mcVersion);
  activateInOptions(gameRoot);

  onProgress?.({
    stage: "install-log",
    level: "ok",
    message: "Estilo de botones",
    detail: "Botones limpios activados",
  });

  return { applied: true, dest };
}
