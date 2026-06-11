const CUENTA_PREFIX = /^cuenta\s+/i;

/** Quita el prefijo legacy "Cuenta " de etiquetas de sesión/token. */
export function stripCuentaDisplayPrefix(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const stripped = trimmed.replace(CUENTA_PREFIX, "").trim();
  return stripped || undefined;
}

/** Nombre visible en launcher: prioriza displayName del usuario y limpia prefijos legacy. */
export function resolveSessionDisplayName(
  displayName?: string | null,
  username?: string | null
): string | undefined {
  const fromDisplay = stripCuentaDisplayPrefix(displayName);
  if (fromDisplay) return fromDisplay;
  const fromUser = username?.trim();
  return fromUser || undefined;
}

/** Etiqueta corta para chrome del hub (username primero, sin prefijo "Cuenta"). */
export function resolveAccountLabel(
  username?: string | null,
  displayName?: string | null
): string | null {
  const u = username?.trim();
  if (u) return u;
  return resolveSessionDisplayName(displayName) ?? null;
}

/** Extrae username de tokens creados como "Cuenta <nombre>". */
export function usernameFromCuentaLabel(label?: string | null): string | undefined {
  const trimmed = label?.trim();
  if (!trimmed || !CUENTA_PREFIX.test(trimmed)) return undefined;
  const stripped = stripCuentaDisplayPrefix(trimmed);
  return stripped?.toLowerCase();
}
