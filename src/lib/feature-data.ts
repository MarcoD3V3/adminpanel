import type {
  ScheduledEvent,
  Mission,
  Modpack,
  SecurityAlert,
  SecurityRule,
  Experiment,
  Integration,
  SeasonTheme,
  SocialProfile,
  ChatReport,
  ChatModStats,
} from "@/types/features";

export const mockScheduledEvents: ScheduledEvent[] = [
  {
    id: "sch1", name: "Mantenimiento semanal", action: "maintenance", scheduledAt: "2026-06-01T02:00:00Z",
    target: "all", payload: { message: "Mantenimiento programado 2-4 AM" }, status: "pending", recurring: "weekly",
  },
  {
    id: "sch2", name: "Doble XP fin de semana", action: "double_xp", scheduledAt: "2026-05-31T00:00:00Z",
    target: "online", payload: { multiplier: 2 }, status: "pending", recurring: "weekly",
  },
  {
    id: "sch3", name: "Push update 1.2.1", action: "force_update", scheduledAt: "2026-05-28T18:00:00Z",
    target: "all", payload: { version: "1.2.1", mandatory: true }, status: "completed", recurring: "once",
  },
  {
    id: "sch4", name: "Evento chat torneo", action: "chat_event", scheduledAt: "2026-05-30T21:00:00Z",
    target: "premium", payload: { channel: "global", pinned: true }, status: "pending", recurring: "once",
  },
];

export const mockMissions: Mission[] = [
  { id: "m1", title: "Jugar 1 hora", description: "Acumula 60 minutos en Minecraft", type: "daily", metric: "play_time", target: 60, rewardPoints: 50, active: true, completions: 892 },
  { id: "m2", title: "Inicia sesión", description: "Abre el launcher hoy", type: "daily", metric: "login", target: 1, rewardPoints: 25, active: true, completions: 2341 },
  { id: "m3", title: "Invita un amigo", description: "Un amigo se registra con tu código", type: "weekly", metric: "invite", target: 1, rewardPoints: 200, active: true, completions: 156 },
  { id: "m4", title: "5 mensajes en chat", description: "Participa en el chat global", type: "daily", metric: "chat", target: 5, rewardPoints: 30, active: true, completions: 445 },
  { id: "m5", title: "Instala un modpack", description: "Instala cualquier modpack premium", type: "special", metric: "modpack_install", target: 1, rewardPoints: 150, active: true, completions: 89, expiresAt: "2026-06-15T00:00:00Z" },
];

export const mockModpacks: Modpack[] = [
  { id: "mp1", name: "SkyBlock+", description: "Survival en el cielo con economía y misiones", mcVersion: "1.20.1", loader: "forge", modCount: 142, downloads: 12400, sizeMb: 890, enabled: true, premiumOnly: true, author: "CraftTeam", updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: "mp2", name: "Vanilla Enhanced", description: "Vanilla mejorado con QoL mods", mcVersion: "1.21.4", loader: "fabric", modCount: 28, downloads: 8900, sizeMb: 120, enabled: true, premiumOnly: false, author: "Community", updatedAt: new Date(Date.now() - 172800000).toISOString() },
  { id: "mp3", name: "Tech Revolution", description: "Create, Mekanism y más", mcVersion: "1.20.1", loader: "forge", modCount: 98, downloads: 5600, sizeMb: 650, enabled: true, premiumOnly: true, author: "ModMaster", updatedAt: new Date(Date.now() - 604800000).toISOString() },
  { id: "mp4", name: "RPG Adventure", description: "Mobs, dungeons y clases", mcVersion: "1.19.2", loader: "forge", modCount: 76, downloads: 3200, sizeMb: 480, enabled: false, premiumOnly: false, author: "AdventureLab", updatedAt: new Date(Date.now() - 1209600000).toISOString() },
];

export const mockSecurityAlerts: SecurityAlert[] = [
  { id: "a1", username: "CreeperBoom", userId: "u5", type: "cheat_client", severity: "critical", detail: "Cliente Wurst detectado en classpath", detectedAt: new Date(Date.now() - 3600000).toISOString(), resolved: false },
  { id: "a2", username: "Hacker99", userId: "u11", type: "modified_jar", severity: "high", detail: "minecraft.jar hash no coincide", detectedAt: new Date(Date.now() - 7200000).toISOString(), resolved: false },
  { id: "a3", username: "AltAccount", userId: "u12", type: "hwid_mismatch", severity: "medium", detail: "HWID cambió en 24h (posible cuenta compartida)", detectedAt: new Date(Date.now() - 86400000).toISOString(), resolved: true },
  { id: "a4", username: "ModFan", userId: "u13", type: "suspicious_mod", severity: "low", detail: "Mod no whitelisted: xray-1.0.jar", detectedAt: new Date(Date.now() - 1800000).toISOString(), resolved: false },
];

export const mockSecurityRules: SecurityRule[] = [
  { id: "sr1", name: "Detectar clients hackeados", description: "Escanea classpath al iniciar MC", enabled: true, action: "ban" },
  { id: "sr2", name: "Verificar hash de JAR", description: "Compara integridad de archivos del juego", enabled: true, action: "kick" },
  { id: "sr3", name: "HWID tracking", description: "Alerta si HWID cambia frecuentemente", enabled: true, action: "flag" },
  { id: "sr4", name: "Whitelist de mods", description: "Solo mods aprobados en modpacks oficiales", enabled: false, action: "notify_admin" },
];

export const mockExperiments: Experiment[] = [
  { id: "ex1", name: "Nuevo diseño launcher", key: "new_ui_v2", description: "UI rediseñada vs actual", status: "running", variantA: "UI actual", variantB: "UI v2", rolloutPercent: 50, metric: "retention", resultA: 52, resultB: 58, startedAt: new Date(Date.now() - 604800000).toISOString() },
  { id: "ex2", name: "Botón Jugar grande", key: "big_play_btn", description: "CTA principal más visible", status: "running", variantA: "Normal", variantB: "Grande", rolloutPercent: 30, metric: "session_time", resultA: 134, resultB: 148, startedAt: new Date(Date.now() - 432000000).toISOString() },
  { id: "ex3", name: "Onboarding simplificado", key: "simple_onboard", description: "Menos pasos al registrarse", status: "completed", variantA: "5 pasos", variantB: "2 pasos", rolloutPercent: 100, metric: "conversion", resultA: 34, resultB: 47, winner: "B", startedAt: new Date(Date.now() - 2592000000).toISOString() },
];

export const mockIntegrations: Integration[] = [
  { id: "i1", name: "Discord Admin", type: "discord", url: "https://discord.com/api/webhooks/...", events: ["user.ban", "security.critical", "liveops.alert"], active: true, lastTriggered: new Date(Date.now() - 1800000).toISOString(), successRate: 99.2 },
  { id: "i2", name: "Telegram Ops", type: "telegram", url: "https://api.telegram.org/bot.../sendMessage", events: ["launcher.crash", "maintenance.start"], active: true, lastTriggered: new Date(Date.now() - 86400000).toISOString(), successRate: 100 },
  { id: "i3", name: "Slack Dev", type: "slack", url: "https://hooks.slack.com/services/...", events: ["experiment.completed", "modpack.publish"], active: false, successRate: 95.5 },
];

export const mockSeasonThemes: SeasonTheme[] = [
  { id: "th1", name: "Default", accentColor: "#496f4f", active: true, startDate: "2026-01-01", endDate: "2026-12-31" },
  { id: "th2", name: "Verano 2026", accentColor: "#5c6358", backgroundUrl: "/themes/summer.jpg", active: false, startDate: "2026-06-21", endDate: "2026-09-22" },
  { id: "th3", name: "Halloween", accentColor: "#635850", active: false, startDate: "2026-10-25", endDate: "2026-11-02" },
  { id: "th4", name: "Navidad", accentColor: "#586260", active: false, startDate: "2026-12-15", endDate: "2027-01-05" },
];

export const mockSocialProfiles: SocialProfile[] = [
  { id: "p1", userId: "u1", username: "SteveCraft", bio: "Builder · Survival lover", status: "playing", premium: true, rank: "Leyenda", playTimeHours: 342, achievements: 28, friends: 47, badges: ["Fundador", "1000h", "Premium"], visibility: "public" },
  { id: "p2", userId: "u4", username: "DiamondPro", bio: "PvP · Speedrunner", status: "playing", premium: true, rank: "Leyenda", playTimeHours: 890, achievements: 45, friends: 112, badges: ["Campeón PvP", "Premium", "Beta Tester"], visibility: "public" },
  { id: "p3", userId: "u2", username: "AlexMiner", bio: "", status: "online", premium: true, rank: "Artesano", playTimeHours: 128, achievements: 12, friends: 23, badges: ["Premium"], visibility: "friends" },
  { id: "p4", userId: "u3", username: "NotchFan99", bio: "Casual player", status: "offline", premium: false, rank: "Explorador", playTimeHours: 45, achievements: 3, friends: 5, badges: [], visibility: "public" },
];

export const mockChatReports: ChatReport[] = [
  { id: "r1", messageId: "c3", reporterName: "SteveCraft", reportedName: "CreeperBoom", reason: "Lenguaje inapropiado", status: "pending", timestamp: new Date(Date.now() - 1800000).toISOString() },
  { id: "r2", messageId: "c8", reporterName: "AlexMiner", reportedName: "SpamBot", reason: "Spam / flood", status: "action_taken", timestamp: new Date(Date.now() - 86400000).toISOString() },
];

export const mockChatModStats: ChatModStats = {
  messagesFiltered: 234,
  spamBlocked: 89,
  usersMuted: 12,
  autoActionsToday: 34,
};

export const scheduleActionLabels: Record<string, string> = {
  maintenance: "Mantenimiento",
  notification: "Notificación",
  force_update: "Forzar update",
  broadcast: "Broadcast",
  double_xp: "Doble XP",
  chat_event: "Evento chat",
};

export const missionMetricLabels: Record<string, string> = {
  play_time: "Tiempo de juego (min)",
  login: "Inicios de sesión",
  invite: "Invitaciones",
  chat: "Mensajes chat",
  modpack_install: "Instalar modpack",
  event: "Completar evento",
};

export const severityColors: Record<string, string> = {
  low: "bg-[var(--color-surface-hover)] text-[var(--color-text-soft)] border-[var(--color-border-subtle)]",
  medium: "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border-[var(--color-border-subtle)]",
  high: "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border-[var(--color-border-subtle)]",
  critical: "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border-[var(--color-border)]",
};
