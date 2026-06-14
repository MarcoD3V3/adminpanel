import { getSqliteDb } from "@/lib/db/sqlite";

export type PlayerPortalPreferenceKey =
  | "emailDigest"
  | "missionReminders"
  | "publicProfile"
  | "activityFeedEnabled"
  | "showCharts"
  | "compactMode";

export type PlayerPortalPreferences = Record<PlayerPortalPreferenceKey, boolean>;

const DEFAULTS: PlayerPortalPreferences = {
  emailDigest: true,
  missionReminders: true,
  publicProfile: false,
  activityFeedEnabled: true,
  showCharts: true,
  compactMode: false,
};

const ALLOWED_KEYS = new Set<string>(Object.keys(DEFAULTS));

function rowToPrefs(raw: string | null): PlayerPortalPreferences {
  if (!raw) return { ...DEFAULTS };
  try {
    const parsed = JSON.parse(raw) as Partial<PlayerPortalPreferences>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function getPlayerPortalPreferences(userId: string): PlayerPortalPreferences {
  const row = getSqliteDb()
    .prepare("SELECT prefs_json FROM player_portal_prefs WHERE user_id = ?")
    .get(userId) as { prefs_json: string } | undefined;
  return rowToPrefs(row?.prefs_json ?? null);
}

export function setPlayerPortalPreference(
  userId: string,
  key: string,
  value: boolean
): { ok: true; preferences: PlayerPortalPreferences } | { ok: false; error: string } {
  if (!ALLOWED_KEYS.has(key)) {
    return { ok: false, error: "Preferencia no válida" };
  }

  const current = getPlayerPortalPreferences(userId);
  const next = { ...current, [key]: value };
  const now = new Date().toISOString();

  getSqliteDb()
    .prepare(
      `INSERT INTO player_portal_prefs (user_id, prefs_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET prefs_json = excluded.prefs_json, updated_at = excluded.updated_at`
    )
    .run(userId, JSON.stringify(next), now);

  return { ok: true, preferences: next };
}

export function listPreferenceDefinitions(): Array<{
  key: PlayerPortalPreferenceKey;
  label: string;
  description: string;
  category: string;
  linkedSectionId: string;
}> {
  return [
    {
      key: "emailDigest",
      label: "Resumen por email",
      description: "Recibe un digest semanal de puntos, misiones y eventos del ecosistema.",
      category: "Comunicación",
      linkedSectionId: "notifications-inbox",
    },
    {
      key: "missionReminders",
      label: "Recordatorios de misiones",
      description: "Avisos cuando una misión está por expirar o cerca de completarse.",
      category: "Misiones",
      linkedSectionId: "missions-active",
    },
    {
      key: "publicProfile",
      label: "Perfil público",
      description: "Tu rango y logros visibles en rankings y hub social del launcher.",
      category: "Social",
      linkedSectionId: "account-tier",
    },
    {
      key: "activityFeedEnabled",
      label: "Feed de actividad",
      description: "Muestra tu línea de tiempo unificada en el resumen del portal.",
      category: "Actividad",
      linkedSectionId: "security-audit",
    },
    {
      key: "showCharts",
      label: "Gráficos analíticos",
      description: "Visualizaciones de puntos, progreso y tendencias en cada sección.",
      category: "Recompensas",
      linkedSectionId: "rewards-transactions",
    },
    {
      key: "compactMode",
      label: "Vista compacta",
      description: "Reduce espaciado para ver más bloques en pantallas pequeñas.",
      category: "Sistema",
      linkedSectionId: "hub-sync",
    },
  ];
}
