import type {
  ActivityItem,
  AnalyticsPoint,
  AutomationRule,
  ChatMessage,
  ContentBanner,
  DashboardStats,
  FeatureFlag,
  LauncherInstance,
  McVersion,
  Notification,
  RemoteEvent,
  RewardTier,
  User,
  LiveOpsSession,
} from "@/types";

export const mockUsers: User[] = [
  {
    id: "u1",
    username: "SteveCraft",
    email: "steve@example.com",
    status: "playing",
    premium: true,
    lastSeen: new Date(Date.now() - 120000).toISOString(),
    launcherVersion: "1.2.0",
    playTimeHours: 342,
  },
  {
    id: "u2",
    username: "AlexMiner",
    email: "alex@example.com",
    status: "online",
    premium: true,
    lastSeen: new Date(Date.now() - 300000).toISOString(),
    launcherVersion: "1.2.0",
    playTimeHours: 128,
  },
  {
    id: "u3",
    username: "NotchFan99",
    email: "notch@example.com",
    status: "offline",
    premium: false,
    lastSeen: new Date(Date.now() - 86400000).toISOString(),
    launcherVersion: "1.1.5",
    playTimeHours: 45,
  },
  {
    id: "u4",
    username: "DiamondPro",
    email: "diamond@example.com",
    status: "playing",
    premium: true,
    lastSeen: new Date(Date.now() - 60000).toISOString(),
    launcherVersion: "1.2.0",
    playTimeHours: 890,
  },
  {
    id: "u5",
    username: "CreeperBoom",
    email: "creeper@example.com",
    status: "banned",
    premium: false,
    lastSeen: new Date(Date.now() - 604800000).toISOString(),
    launcherVersion: "1.0.0",
    playTimeHours: 12,
  },
  {
    id: "u6",
    username: "RedstoneKing",
    email: "redstone@example.com",
    status: "online",
    premium: true,
    lastSeen: new Date(Date.now() - 180000).toISOString(),
    launcherVersion: "1.2.0",
    playTimeHours: 567,
  },
];

export const mockLaunchers: LauncherInstance[] = [
  {
    id: "l1",
    userId: "u1",
    username: "SteveCraft",
    status: "online",
    version: "1.2.0",
    ip: "192.168.1.45",
    os: "Windows 11",
    ramUsage: 62,
    cpuUsage: 34,
    connectedAt: new Date(Date.now() - 3600000).toISOString(),
    minecraftVersion: "1.21.4",
  },
  {
    id: "l2",
    userId: "u2",
    username: "AlexMiner",
    status: "launching",
    version: "1.2.0",
    ip: "10.0.0.12",
    os: "Windows 10",
    ramUsage: 45,
    cpuUsage: 78,
    connectedAt: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: "l3",
    userId: "u4",
    username: "DiamondPro",
    status: "online",
    version: "1.2.0",
    ip: "172.16.0.88",
    os: "Windows 11",
    ramUsage: 81,
    cpuUsage: 56,
    connectedAt: new Date(Date.now() - 7200000).toISOString(),
    minecraftVersion: "1.21.4",
  },
  {
    id: "l4",
    userId: "u6",
    username: "RedstoneKing",
    status: "updating",
    version: "1.1.5",
    ip: "192.168.0.23",
    os: "Windows 11",
    ramUsage: 28,
    cpuUsage: 12,
    connectedAt: new Date(Date.now() - 900000).toISOString(),
  },
];

export const mockNotifications: Notification[] = [
  {
    id: "n1",
    title: "Actualización v1.2.0 disponible",
    message: "Nueva versión con mejoras de rendimiento y chat global.",
    target: "all",
    type: "update",
    display: "toast",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    sent: true,
    readCount: 1247,
  },
  {
    id: "n2",
    title: "Mantenimiento programado",
    message: "Servidores en mantenimiento el sábado de 2:00 a 4:00 AM.",
    target: "online",
    type: "warning",
    display: "banner",
    createdAt: new Date(Date.now() - 43200000).toISOString(),
    sent: true,
    readCount: 89,
  },
  {
    id: "n3",
    title: "Evento PvP este fin de semana",
    message: "¡Participa en el torneo y gana premios premium!",
    target: "premium",
    type: "info",
    display: "alert",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    sent: false,
    readCount: 0,
  },
];

export const mockEvents: RemoteEvent[] = [
  {
    id: "e1",
    type: "force_update",
    payload: { version: "1.2.0", mandatory: true },
    target: "all",
    status: "completed",
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    executedCount: 3421,
  },
  {
    id: "e2",
    type: "broadcast_event",
    payload: { eventName: "double_xp_weekend", multiplier: 2 },
    target: "online",
    status: "executing",
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    executedCount: 156,
  },
  {
    id: "e3",
    type: "maintenance_mode",
    payload: { enabled: false, message: "" },
    target: "all",
    status: "pending",
    createdAt: new Date(Date.now() - 600000).toISOString(),
    executedCount: 0,
  },
];

export const mockChatMessages: ChatMessage[] = [
  {
    id: "c1",
    channel: "global",
    senderId: "u1",
    senderName: "SteveCraft",
    content: "¿Alguien quiere jugar survival?",
    timestamp: new Date(Date.now() - 300000).toISOString(),
    flagged: false,
  },
  {
    id: "c2",
    channel: "global",
    senderId: "u4",
    senderName: "DiamondPro",
    content: "Yo me apunto, invítame al server",
    timestamp: new Date(Date.now() - 240000).toISOString(),
    flagged: false,
  },
  {
    id: "c3",
    channel: "global",
    senderId: "u5",
    senderName: "CreeperBoom",
    content: "mensaje inapropiado filtrado",
    timestamp: new Date(Date.now() - 180000).toISOString(),
    flagged: true,
  },
  {
    id: "c4",
    channel: "friends",
    senderId: "u2",
    senderName: "AlexMiner",
    content: "Oye Steve, ¿viste la nueva actualización?",
    timestamp: new Date(Date.now() - 120000).toISOString(),
    flagged: false,
  },
  {
    id: "c5",
    channel: "global",
    senderId: "u6",
    senderName: "RedstoneKing",
    content: "El launcher va súper fluido con la v1.2.0 🔥",
    timestamp: new Date(Date.now() - 60000).toISOString(),
    flagged: false,
  },
];

export const mockActivity: ActivityItem[] = [
  {
    id: "a1",
    type: "launch",
    message: "DiamondPro inició Minecraft 1.21.4",
    timestamp: new Date(Date.now() - 120000).toISOString(),
    user: "DiamondPro",
  },
  {
    id: "a2",
    type: "login",
    message: "RedstoneKing conectó al launcher",
    timestamp: new Date(Date.now() - 300000).toISOString(),
    user: "RedstoneKing",
  },
  {
    id: "a3",
    type: "chat",
    message: "Nuevo mensaje en chat global",
    timestamp: new Date(Date.now() - 360000).toISOString(),
  },
  {
    id: "a4",
    type: "event",
    message: "Evento broadcast_event ejecutado en 156 launchers",
    timestamp: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: "a5",
    type: "notification",
    message: "Notificación enviada a usuarios premium",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
];

export function getDashboardStats(): DashboardStats {
  return {
    totalUsers: mockUsers.length,
    onlineUsers: mockUsers.filter((u) => u.status === "online" || u.status === "playing").length,
    activeLaunchers: mockLaunchers.filter((l) => l.status !== "offline").length,
    premiumUsers: mockUsers.filter((u) => u.premium).length,
    messagesToday: mockChatMessages.length * 48,
    pendingEvents: mockEvents.filter((e) => e.status === "pending").length,
  };
}

export const eventTypeLabels: Record<string, string> = {
  force_update: "Forzar actualización",
  restart_launcher: "Reiniciar launcher",
  kill_game: "Cerrar Minecraft",
  send_message: "Enviar mensaje popup",
  open_url: "Abrir URL",
  maintenance_mode: "Modo mantenimiento",
  broadcast_event: "Evento broadcast",
  sync_config: "Sincronizar config",
};

export const statusColors: Record<string, string> = {
  online: "bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-[var(--color-border)]",
  offline: "bg-[var(--color-surface-hover)] text-[var(--color-muted)] border-[var(--color-border-subtle)]",
  playing: "bg-[var(--color-accent-soft)] text-[var(--color-accent-hover)] border-[var(--color-border)]",
  banned: "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border-[var(--color-border-subtle)]",
  launching: "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border-[var(--color-border)]",
  updating: "bg-[var(--color-surface-hover)] text-[var(--color-text-soft)] border-[var(--color-border)]",
  pending: "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border-[var(--color-border)]",
  executing: "bg-[var(--color-surface-hover)] text-[var(--color-text-soft)] border-[var(--color-border)]",
  completed: "bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-[var(--color-border)]",
  failed: "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border-[var(--color-border-subtle)]",
};

export const mockFeatureFlags: FeatureFlag[] = [
  { id: "f1", name: "Chat global", key: "global_chat", description: "Chat en tiempo real entre usuarios activos", enabled: true, rollout: 100, audience: "all" },
  { id: "f2", name: "Modpack rápido", key: "quick_modpack", description: "Instalación one-click de modpacks", enabled: true, rollout: 60, audience: "premium" },
  { id: "f3", name: "Shader preview", key: "shader_preview", description: "Vista previa de shaders antes de jugar", enabled: false, rollout: 0, audience: "beta" },
  { id: "f4", name: "Party system", key: "party_system", description: "Unirse a amigos con un clic", enabled: true, rollout: 25, audience: "beta" },
];

export const mockBanners: ContentBanner[] = [
  { id: "b1", title: "Temporada de invierno", subtitle: "Skins y capas exclusivas premium", cta: "Ver evento", active: true, position: "hero" },
  { id: "b2", title: "Nuevo modpack: SkyBlock+", subtitle: "Instala en 1 clic", cta: "Instalar", active: true, position: "sidebar" },
  { id: "b3", title: "Actualización 1.2.0", subtitle: "Mejor rendimiento y chat mejorado", cta: "Notas del parche", active: false, position: "popup" },
];

export const mockAutomationRules: AutomationRule[] = [
  { id: "r1", name: "Auto-ban spam chat", trigger: "3 mensajes flagged en 5 min", action: "Ban temporal 24h", enabled: true, lastRun: new Date(Date.now() - 7200000).toISOString() },
  { id: "r2", name: "Notificar versión obsoleta", trigger: "Launcher < v1.2.0", action: "Push notification update", enabled: true, lastRun: new Date(Date.now() - 3600000).toISOString() },
  { id: "r3", name: "Backup config diario", trigger: "Cron 03:00 UTC", action: "Export config to S3", enabled: true, lastRun: new Date(Date.now() - 86400000).toISOString() },
  { id: "r4", name: "Welcome premium", trigger: "Nuevo usuario premium", action: "Enviar mensaje + 500 puntos", enabled: false },
];

export const mockRewardTiers: RewardTier[] = [
  { id: "t1", name: "Explorador", pointsRequired: 0, perks: ["Avatar básico", "Chat global"], members: 3421 },
  { id: "t2", name: "Artesano", pointsRequired: 500, perks: ["Capas exclusivas", "Prioridad en servidores"], members: 892 },
  { id: "t3", name: "Leyenda", pointsRequired: 2000, perks: ["Modpacks premium", "Badge dorado", "Eventos VIP"], members: 156 },
];

export const mockMcVersions: McVersion[] = [
  { id: "v1", version: "1.21.4", type: "release", enabled: true, downloads: 12400, javaRequired: "21" },
  { id: "v2", version: "1.21.3", type: "release", enabled: true, downloads: 3200, javaRequired: "21" },
  { id: "v3", version: "1.20.4", type: "release", enabled: true, downloads: 8900, javaRequired: "17" },
  { id: "v4", version: "25w01a", type: "snapshot", enabled: false, downloads: 340, javaRequired: "21" },
  { id: "v5", version: "Forge 1.20.1", type: "modded", enabled: true, downloads: 5600, javaRequired: "17" },
];

export const mockWeeklyActive: AnalyticsPoint[] = [
  { label: "Lun", value: 420 },
  { label: "Mar", value: 380 },
  { label: "Mié", value: 510 },
  { label: "Jue", value: 490 },
  { label: "Vie", value: 680 },
  { label: "Sáb", value: 920 },
  { label: "Dom", value: 850 },
];

export const mockRetention: AnalyticsPoint[] = [
  { label: "D1", value: 78 },
  { label: "D7", value: 52 },
  { label: "D14", value: 41 },
  { label: "D30", value: 34 },
];

export const mockLiveOpsSessions: LiveOpsSession[] = [
  {
    id: "s1", userId: "u1", username: "SteveCraft", status: "playing", premium: true,
    country: "España", countryCode: "ES", city: "Madrid", lat: 40.4, lng: -3.7,
    launcherVersion: "1.2.0", minecraftVersion: "1.21.4", os: "Windows 11",
    ip: "192.168.1.45", ramUsage: 62, cpuUsage: 34, health: "healthy",
    connectedAt: new Date(Date.now() - 3600000).toISOString(), launcherId: "l1",
  },
  {
    id: "s2", userId: "u2", username: "AlexMiner", status: "launching", premium: true,
    country: "México", countryCode: "MX", city: "CDMX", lat: 19.4, lng: -99.1,
    launcherVersion: "1.2.0", os: "Windows 10",
    ip: "10.0.0.12", ramUsage: 45, cpuUsage: 78, health: "warning",
    connectedAt: new Date(Date.now() - 1800000).toISOString(), launcherId: "l2",
  },
  {
    id: "s3", userId: "u4", username: "DiamondPro", status: "playing", premium: true,
    country: "Estados Unidos", countryCode: "US", city: "New York", lat: 40.7, lng: -74.0,
    launcherVersion: "1.2.0", minecraftVersion: "1.21.4", os: "Windows 11",
    ip: "172.16.0.88", ramUsage: 81, cpuUsage: 56, health: "warning",
    connectedAt: new Date(Date.now() - 7200000).toISOString(), launcherId: "l3",
  },
  {
    id: "s4", userId: "u6", username: "RedstoneKing", status: "updating", premium: true,
    country: "Alemania", countryCode: "DE", city: "Berlin", lat: 52.5, lng: 13.4,
    launcherVersion: "1.1.5", os: "Windows 11",
    ip: "192.168.0.23", ramUsage: 28, cpuUsage: 92, health: "critical",
    connectedAt: new Date(Date.now() - 900000).toISOString(), launcherId: "l4",
  },
  {
    id: "s5", userId: "u7", username: "NetherKnight", status: "playing", premium: false,
    country: "Brasil", countryCode: "BR", city: "São Paulo", lat: -23.5, lng: -46.6,
    launcherVersion: "1.2.0", minecraftVersion: "1.20.4", os: "Windows 10",
    ip: "177.10.0.44", ramUsage: 55, cpuUsage: 41, health: "healthy",
    connectedAt: new Date(Date.now() - 5400000).toISOString(), launcherId: "l5",
  },
  {
    id: "s6", userId: "u8", username: "EnderElite", status: "online", premium: true,
    country: "Reino Unido", countryCode: "GB", city: "London", lat: 51.5, lng: -0.1,
    launcherVersion: "1.2.0", os: "Windows 11",
    ip: "82.12.0.88", ramUsage: 22, cpuUsage: 8, health: "healthy",
    connectedAt: new Date(Date.now() - 600000).toISOString(), launcherId: "l6",
  },
  {
    id: "s7", userId: "u9", username: "TokyoBuilder", status: "playing", premium: true,
    country: "Japón", countryCode: "JP", city: "Tokyo", lat: 35.7, lng: 139.7,
    launcherVersion: "1.2.0", minecraftVersion: "1.21.4", os: "Windows 11",
    ip: "210.0.0.12", ramUsage: 71, cpuUsage: 48, health: "healthy",
    connectedAt: new Date(Date.now() - 4200000).toISOString(), launcherId: "l7",
  },
  {
    id: "s8", userId: "u10", username: "AndesCraft", status: "idle", premium: false,
    country: "Argentina", countryCode: "AR", city: "Buenos Aires", lat: -34.6, lng: -58.4,
    launcherVersion: "1.2.0", os: "Windows 10",
    ip: "190.0.0.55", ramUsage: 18, cpuUsage: 5, health: "healthy",
    connectedAt: new Date(Date.now() - 2400000).toISOString(), launcherId: "l8",
  },
];

export function latLngToMapPercent(lat: number, lng: number): { x: number; y: number } {
  return {
    x: ((lng + 180) / 360) * 100,
    y: ((90 - lat) / 180) * 100,
  };
}
