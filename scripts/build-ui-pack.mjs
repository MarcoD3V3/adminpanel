#!/usr/bin/env node
/**
 * Genera el resource pack "CraftLauncher Clean" (look minimalista):
 *   - Botones planos (widgets.png)
 *   - Fondo sólido oscuro (panorama)
 *   - Logo Minecraft monocromo limpio
 *   - "JAVA EDITION" oculto (edition.png transparente)
 *   - Sin splash amarillo (splashes.txt vacío)
 *
 * Conserva el resto de texturas. Usa sharp (solo en build).
 * Uso: node scripts/build-ui-pack.mjs 1.18.2
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import AdmZipPkg from "adm-zip";

const AdmZip = AdmZipPkg.default ?? AdmZipPkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const mcVersion = process.argv[2] ?? "1.18.2";

const PACK_ID = "craftlauncher-clean";
const PACK_DIR = path.join(ROOT, "packages", "launcher", "assets", "resourcepacks", PACK_ID);

// ---- Tema ----
const BG_SOLID = { r: 0x17, g: 0x18, b: 0x1b }; // fondo
const BTN_X = 0;
const BTN_W = 200;
const BTN_H = 20;
const BTN_ROWS = {
  disabled: { y: 46, fill: [0x24, 0x26, 0x2a, 0xff], border: [0x30, 0x32, 0x36, 0xff] },
  normal: { y: 66, fill: [0x2b, 0x2e, 0x33, 0xff], border: [0x44, 0x48, 0x4f, 0xff] },
  hover: { y: 86, fill: [0x3a, 0x3e, 0x45, 0xff], border: [0x6a, 0x70, 0x79, 0xff] },
};

function findClientExtraJar() {
  const roots = [
    path.join(process.env.APPDATA ?? "", ".craftlauncher", "cache", mcVersion, "libraries"),
    path.join(process.env.USERPROFILE ?? "", ".craftlauncher", "cache", mcVersion, "libraries"),
  ];
  for (const libraryRoot of roots) {
    const base = path.join(libraryRoot, "net", "minecraft", "client");
    if (!fs.existsSync(base)) continue;
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith(mcVersion)) continue;
      const dir = path.join(base, entry.name);
      for (const f of fs.readdirSync(dir)) {
        if (f.includes("-extra.jar")) return path.join(dir, f);
      }
    }
  }
  return null;
}

function setPx(buf, w, x, y, rgba) {
  const i = (y * w + x) * 4;
  buf[i] = rgba[0];
  buf[i + 1] = rgba[1];
  buf[i + 2] = rgba[2];
  buf[i + 3] = rgba[3];
}

function paintButton(buf, w, { y, fill, border }) {
  for (let dy = 0; dy < BTN_H; dy++) {
    for (let dx = 0; dx < BTN_W; dx++) {
      const isBorder = dx === 0 || dx === BTN_W - 1 || dy === 0 || dy === BTN_H - 1;
      setPx(buf, w, BTN_X + dx, y + dy, isBorder ? border : fill);
    }
  }
}

function texPath(...p) {
  return path.join(PACK_DIR, "assets", "minecraft", "textures", ...p);
}

async function buildWidgets(zip) {
  const entry = zip.getEntry("assets/minecraft/textures/gui/widgets.png");
  const { data, info } = await sharp(entry.getData()).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const buf = Buffer.from(data);
  for (const row of Object.values(BTN_ROWS)) paintButton(buf, info.width, row);
  const png = await sharp(buf, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  const dir = texPath("gui");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "widgets.png"), png);
}

async function buildBackground() {
  const dir = texPath("gui", "title", "background");
  fs.mkdirSync(dir, { recursive: true });
  const face = await sharp({
    create: { width: 256, height: 256, channels: 4, background: { ...BG_SOLID, alpha: 1 } },
  }).png().toBuffer();
  for (let i = 0; i < 6; i++) fs.writeFileSync(path.join(dir, `panorama_${i}.png`), face);
  // overlay transparente (sin viñeta)
  const overlay = await sharp({
    create: { width: 16, height: 16, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).png().toBuffer();
  fs.writeFileSync(path.join(dir, "panorama_overlay.png"), overlay);
}

async function buildEditionHidden(zip) {
  const entry = zip.getEntry("assets/minecraft/textures/gui/title/edition.png");
  const meta = await sharp(entry.getData()).metadata();
  const transparent = await sharp({
    create: { width: meta.width, height: meta.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).png().toBuffer();
  const dir = texPath("gui", "title");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "edition.png"), transparent);
}

async function buildLogoClean(zip) {
  const entry = zip.getEntry("assets/minecraft/textures/gui/title/minecraft.png");
  const { data, info } = await sharp(entry.getData()).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const buf = Buffer.from(data);
  // Recolorea cada pixel visible a blanco plano, conservando alfa → logo limpio monocromo
  for (let i = 0; i < buf.length; i += 4) {
    const a = buf[i + 3];
    if (a > 16) {
      buf[i] = 0xe8;
      buf[i + 1] = 0xea;
      buf[i + 2] = 0xed;
    }
  }
  const png = await sharp(buf, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  const dir = texPath("gui", "title");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "minecraft.png"), png);
}

function buildNoSplash() {
  const dir = path.join(PACK_DIR, "assets", "minecraft", "texts");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "splashes.txt"), "\n", "utf-8");
}

function writeMeta() {
  fs.writeFileSync(
    path.join(PACK_DIR, "pack.mcmeta"),
    JSON.stringify({ pack: { pack_format: 8, description: "CraftLauncher · UI limpia" } }, null, 2),
    "utf-8"
  );
}

async function main() {
  const jar = findClientExtraJar();
  if (!jar) {
    console.error(`No se encontró client-extra.jar para ${mcVersion}. Lanza el juego una vez.`);
    process.exit(1);
  }
  const zip = new AdmZip(jar);

  await buildWidgets(zip);
  await buildBackground();
  await buildEditionHidden(zip);
  await buildLogoClean(zip);
  buildNoSplash();
  writeMeta();

  console.log(`✓ Resource pack '${PACK_ID}' generado:`);
  console.log("  · Botones planos");
  console.log("  · Fondo sólido oscuro");
  console.log("  · Logo monocromo limpio");
  console.log("  · 'JAVA EDITION' oculto");
  console.log("  · Sin splash amarillo");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
