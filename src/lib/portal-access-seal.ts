import { sealPortalAccess } from "@craftlauncher/shared";

export async function sealPasswordForPortalClipboard(
  password: string
): Promise<string | undefined> {
  const secret = process.env.PORTAL_CLIPBOARD_SECRET?.trim();
  if (!secret || secret.length < 16) return undefined;
  try {
    return await sealPortalAccess(password, secret);
  } catch {
    return undefined;
  }
}

export function isPortalClipboardSecretConfigured(): boolean {
  const secret = process.env.PORTAL_CLIPBOARD_SECRET?.trim();
  return Boolean(secret && secret.length >= 16);
}
