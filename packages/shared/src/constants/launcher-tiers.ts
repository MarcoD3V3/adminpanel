export const LAUNCHER_TOKEN_TIERS = [
  { id: "free", label: "Free (mods CurseForge)" },
  { id: "premium", label: "Premium (todo)" },
  { id: "tester", label: "Tester (solo nombre MC)" },
] as const;

export type LauncherTokenTierId = (typeof LAUNCHER_TOKEN_TIERS)[number]["id"];

export type LauncherTier = LauncherTokenTierId;

export function isTesterTier(tier?: string | null): boolean {
  return tier === "tester";
}

export function isPremiumTier(tier?: string | null): boolean {
  return tier === "premium";
}

export function normalizeLauncherTier(tier?: string | null): LauncherTier {
  if (tier === "premium") return "premium";
  if (tier === "tester") return "tester";
  return "free";
}

/** Nombre válido para perfil offline de Minecraft (3–16, a-z A-Z 0-9 _). */
export function isValidMinecraftUsername(name: string): boolean {
  const trimmed = name.trim();
  return /^[a-zA-Z0-9_]{3,16}$/.test(trimmed);
}

export function normalizeMinecraftUsername(name: string): string | null {
  if (!isValidMinecraftUsername(name)) return null;
  return name.trim();
}
