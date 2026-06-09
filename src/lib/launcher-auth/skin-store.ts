import fs from "node:fs";
import path from "node:path";
import { loadAuthStore } from "./store";

const SKINS_DIR = path.join(process.cwd(), "data", "user-skins");
const META_FILE = path.join(SKINS_DIR, "meta.json");
const MAX_BYTES = 512 * 1024;
const ALLOWED_DIMS = new Set([
  "64x32",
  "64x64",
  "128x64",
  "128x128",
  "256x128",
  "256x256",
]);

export type SkinMetaEntry = {
  userId: string;
  username: string;
  updatedAt: string;
};

type SkinMetaStore = {
  entries: Record<string, SkinMetaEntry>;
};

function ensureDir() {
  fs.mkdirSync(SKINS_DIR, { recursive: true });
}

function skinPath(userId: string) {
  return path.join(SKINS_DIR, `${userId}.png`);
}

function readMeta(): SkinMetaStore {
  ensureDir();
  try {
    const raw = fs.readFileSync(META_FILE, "utf-8");
    const parsed = JSON.parse(raw) as SkinMetaStore;
    if (parsed?.entries && typeof parsed.entries === "object") return parsed;
  } catch {
    /* fresh */
  }
  return { entries: {} };
}

function writeMeta(store: SkinMetaStore) {
  ensureDir();
  fs.writeFileSync(META_FILE, JSON.stringify(store, null, 2), "utf-8");
}

function isPngSignature(buf: Buffer): boolean {
  if (buf.length < 8) return false;
  return (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  );
}

function parsePngDimensions(buf: Buffer): { width: number; height: number } | null {
  if (!isPngSignature(buf)) return null;

  // IHDR suele ir justo tras la firma PNG (offset 12 = tipo "IHDR").
  if (buf.length >= 24 && buf.toString("ascii", 12, 16) === "IHDR") {
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    if (width > 0 && height > 0 && width <= 512 && height <= 512) {
      return { width, height };
    }
  }

  // Fallback: buscar chunk IHDR por si el exportador mete metadatos raros.
  for (let i = 8; i <= buf.length - 13; i++) {
    if (buf.toString("ascii", i, i + 4) !== "IHDR") continue;
    const width = buf.readUInt32BE(i + 4);
    const height = buf.readUInt32BE(i + 8);
    if (width > 0 && height > 0 && width <= 512 && height <= 512) {
      return { width, height };
    }
  }

  return null;
}

export function validateSkinPng(buf: Buffer): { ok: true } | { ok: false; error: string } {
  if (buf.length > MAX_BYTES) {
    return { ok: false, error: "La imagen supera 512 KB" };
  }
  const dims = parsePngDimensions(buf);
  if (!dims) return { ok: false, error: "Archivo PNG inválido" };
  const key = `${dims.width}x${dims.height}`;
  if (!ALLOWED_DIMS.has(key)) {
    return {
      ok: false,
      error: "Dimensiones no válidas. Usa 64×32, 64×64, 128×64 o 128×128",
    };
  }
  return { ok: true };
}

export function skinExists(userId: string): boolean {
  return fs.existsSync(skinPath(userId));
}

export function readSkinPng(userId: string): Buffer | null {
  const file = skinPath(userId);
  if (!fs.existsSync(file)) return null;
  try {
    return fs.readFileSync(file);
  } catch {
    return null;
  }
}

export async function saveUserSkin(
  userId: string,
  username: string,
  png: Buffer
): Promise<{ ok: true; updatedAt: string } | { ok: false; error: string }> {
  const valid = validateSkinPng(png);
  if (!valid.ok) return valid;

  ensureDir();
  fs.writeFileSync(skinPath(userId), png);

  const updatedAt = new Date().toISOString();
  const meta = readMeta();
  meta.entries[userId] = { userId, username: username.toLowerCase(), updatedAt };
  writeMeta(meta);
  return { ok: true, updatedAt };
}

export async function deleteUserSkin(userId: string): Promise<boolean> {
  const file = skinPath(userId);
  let removed = false;
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    removed = true;
  }
  const meta = readMeta();
  if (meta.entries[userId]) {
    delete meta.entries[userId];
    writeMeta(meta);
    removed = true;
  }
  return removed;
}

export async function listSkinRegistry(): Promise<SkinMetaEntry[]> {
  const meta = readMeta();
  const store = await loadAuthStore();
  const activeUsers = new Set(store.users.filter((u) => !u.revoked).map((u) => u.id));

  return Object.values(meta.entries)
    .filter((e) => activeUsers.has(e.userId) && skinExists(e.userId))
    .map((e) => ({ ...e, username: e.username.toLowerCase() }));
}

export function getSkinMeta(userId: string): SkinMetaEntry | null {
  const meta = readMeta();
  return meta.entries[userId] ?? null;
}

export function decodeSkinImageInput(raw: string): Buffer | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let base64 = trimmed;
  if (trimmed.startsWith("data:")) {
    const comma = trimmed.indexOf(",");
    if (comma < 0) return null;
    base64 = trimmed.slice(comma + 1);
  }

  base64 = base64.replace(/\s/g, "");
  if (!base64) return null;

  try {
    const buf = Buffer.from(base64, "base64");
    return buf.length > 0 ? buf : null;
  } catch {
    return null;
  }
}
