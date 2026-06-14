/** Contraseña cifrada para pegar en portapapeles — solo user_web puede descifrarla (servidor). */

export const PORTAL_ACCESS_SEAL_PREFIX = "clenc_v1:";

function bytesToB64url(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64url");
  }
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(padded + pad, "base64"));
  }
  const binary = atob(padded + pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function keyFromSecret(secret: string): Promise<CryptoKey> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export function isPortalAccessSealed(value: string): boolean {
  return value.trim().startsWith(PORTAL_ACCESS_SEAL_PREFIX);
}

/** Cifra la contraseña en texto plano (admin al crear/resetear). */
export async function sealPortalAccess(plaintext: string, secret: string): Promise<string> {
  if (!secret.trim() || secret.trim().length < 16) {
    throw new Error("PORTAL_CLIPBOARD_SECRET demasiado corto (mín. 16 caracteres)");
  }
  const key = await keyFromSecret(secret.trim());
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  const combined = new Uint8Array(iv.length + enc.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(enc), iv.length);
  return PORTAL_ACCESS_SEAL_PREFIX + bytesToB64url(combined);
}

/** Descifra acceso_portal (solo user_web en servidor). */
export async function unsealPortalAccess(sealed: string, secret: string): Promise<string | null> {
  const trimmed = sealed.trim();
  if (!isPortalAccessSealed(trimmed) || !secret.trim()) return null;
  try {
    const raw = b64urlToBytes(trimmed.slice(PORTAL_ACCESS_SEAL_PREFIX.length));
    if (raw.length < 13) return null;
    const iv = raw.slice(0, 12);
    const data = raw.slice(12);
    const key = await keyFromSecret(secret.trim());
    const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
    return new TextDecoder().decode(dec);
  } catch {
    return null;
  }
}
