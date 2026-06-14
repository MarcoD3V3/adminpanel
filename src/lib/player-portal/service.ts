import { loadAuthStore } from "@/lib/launcher-auth/store";
import { getSkinMeta, skinExists } from "@/lib/launcher-auth/skin-store";
import { isTempBanned } from "@/lib/automation/store";
import { getPublicLauncherConfig } from "@/lib/settings/service";
import { getUserRewardsState } from "@/lib/rewards/service";
import {
  dayKey,
  getEconomy,
  getUserProfile,
  listRedeemables,
  listTiers,
} from "@/lib/rewards/store";
import { getSqliteDb } from "@/lib/db/sqlite";
import { pollNotificationsForDevice } from "@/lib/launcher-notifications/service";
import { getActiveAssignments } from "@/lib/experiments/service";
import { listPresenceRecords } from "@/lib/live-ops/service";
import type { VerifySessionResult } from "@/lib/launcher-auth/types";
import type { AuditLogEntry } from "@/lib/launcher-auth/types";
import {
  getPlayerPortalPreferences,
  listPreferenceDefinitions,
  type PlayerPortalPreferences,
} from "@/lib/player-portal/prefs";

export type PlayerPortalSection = {
  id: string;
  title: string;
  category: string;
  summary: string;
  data: Record<string, unknown>;
};

export type PlayerPortalActivityItem = {
  id: string;
  type: "transaction" | "audit" | "redemption" | "mission" | "session";
  title: string;
  detail: string;
  timestamp: string;
  sectionId: string;
  amount?: number;
  positive?: boolean;
};

export type PlayerPortalDashboard = {
  generatedAt: string;
  player: {
    userId: string;
    username: string;
    displayName: string;
    tier: string;
    premium: boolean;
    tester: boolean;
  };
  sections: PlayerPortalSection[];
  stats: {
    totalSections: number;
    points: number;
    tierName: string | null;
    unreadNotifications: number;
    activeMissions: number;
    devicesOnline: number;
  };
  preferences: PlayerPortalPreferences;
  activityFeed: PlayerPortalActivityItem[];
  pointsChart: Array<{ day: string; total: number; label: string }>;
};

function listUserTransactions(userId: string, limit = 20) {
  return (
    getSqliteDb()
      .prepare("SELECT * FROM rewards_point_log WHERE user_id = ? ORDER BY datetime(created_at) DESC LIMIT ?")
      .all(userId, limit) as Array<{
      id: string;
      amount: number;
      balance_after: number;
      reason: string;
      source: string;
      created_at: string;
    }>
  ).map((r) => ({
    id: r.id,
    amount: r.amount,
    balanceAfter: r.balance_after,
    reason: r.reason,
    source: r.source,
    createdAt: r.created_at,
  }));
}

function listUserRedemptions(userId: string) {
  return (
    getSqliteDb()
      .prepare("SELECT * FROM rewards_redemptions WHERE user_id = ? ORDER BY datetime(created_at) DESC LIMIT 30")
      .all(userId) as Array<{
      id: string;
      redeemable_name: string;
      cost: number;
      created_at: string;
    }>
  ).map((r) => ({ id: r.id, name: r.redeemable_name, cost: r.cost, redeemedAt: r.created_at }));
}

function countReferrals(userId: string): number {
  const row = getSqliteDb()
    .prepare("SELECT COUNT(*) AS c FROM rewards_users WHERE referred_by = ?")
    .get(userId) as { c: number };
  return row.c;
}

function countChatFlags(username: string): number {
  const row = getSqliteDb()
    .prepare("SELECT COUNT(*) AS c FROM automation_chat_flags WHERE username = ?")
    .get(username.toLowerCase()) as { c: number };
  return row.c;
}

function getPlayMinutesToday(userId: string): number {
  const row = getSqliteDb()
    .prepare("SELECT play_minutes_today, play_day_key FROM rewards_users WHERE user_id = ?")
    .get(userId) as { play_minutes_today: number; play_day_key: string | null } | undefined;
  if (!row || row.play_day_key !== dayKey()) return 0;
  return row.play_minutes_today;
}

function buildPointsChart(userId: string, days = 7) {
  const rows = getSqliteDb()
    .prepare(
      `SELECT date(created_at) AS day, SUM(amount) AS total
       FROM rewards_point_log
       WHERE user_id = ? AND datetime(created_at) >= datetime('now', ?)
       GROUP BY date(created_at)
       ORDER BY day ASC`
    )
    .all(userId, `-${days} days`) as Array<{ day: string; total: number }>;

  const byDay = new Map(rows.map((r) => [r.day, r.total]));
  const result: Array<{ day: string; total: number; label: string }> = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("es", { weekday: "short", day: "numeric" });
    result.push({ day: key, total: byDay.get(key) ?? 0, label });
  }

  return result;
}

function buildActivityFeed(input: {
  transactions: ReturnType<typeof listUserTransactions>;
  audit: AuditLogEntry[];
  redemptions: ReturnType<typeof listUserRedemptions>;
  missions: Array<{ missionId: string; title: string; completed: boolean; rewardPoints: number; progress: number; target: number }>;
  sessions: Array<{ id: string; lastSeenAt?: string; current?: boolean }>;
}): PlayerPortalActivityItem[] {
  const items: PlayerPortalActivityItem[] = [];

  for (const tx of input.transactions) {
    items.push({
      id: `tx-${tx.id}`,
      type: "transaction",
      title: tx.amount >= 0 ? "Puntos ganados" : "Puntos gastados",
      detail: tx.reason || tx.source,
      timestamp: tx.createdAt,
      sectionId: "rewards-transactions",
      amount: tx.amount,
      positive: tx.amount >= 0,
    });
  }

  for (const ev of input.audit) {
    items.push({
      id: `audit-${ev.id}`,
      type: "audit",
      title: humanAuditAction(ev.action),
      detail: ev.meta ?? ev.action,
      timestamp: ev.at,
      sectionId: "security-audit",
    });
  }

  for (const r of input.redemptions) {
    items.push({
      id: `red-${r.id}`,
      type: "redemption",
      title: "Canje realizado",
      detail: r.name,
      timestamp: r.redeemedAt,
      sectionId: "rewards-inventory",
      amount: -r.cost,
      positive: false,
    });
  }

  for (const m of input.missions.filter((x) => x.completed)) {
    items.push({
      id: `mission-${m.missionId}`,
      type: "mission",
      title: "Misión completada",
      detail: m.title,
      timestamp: new Date().toISOString(),
      sectionId: "missions-completed",
      amount: m.rewardPoints,
      positive: true,
    });
  }

  for (const s of input.sessions.slice(0, 3)) {
    if (s.lastSeenAt) {
      items.push({
        id: `session-${s.id}`,
        type: "session",
        title: s.current ? "Sesión actual" : "Dispositivo conectado",
        detail: s.current ? "Este portal" : "Otro dispositivo",
        timestamp: s.lastSeenAt,
        sectionId: "account-sessions",
      });
    }
  }

  return items
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, 40);
}

function humanAuditAction(action: AuditLogEntry["action"]): string {
  const map: Partial<Record<AuditLogEntry["action"], string>> = {
    activation_success: "Cuenta activada",
    session_revoked: "Sesión cerrada",
    token_created: "Token generado",
    token_revoked: "Token revocado",
    admin_login: "Acceso admin",
    user_created: "Perfil creado",
    user_updated: "Perfil actualizado",
    user_login_success: "Inicio de sesión",
    user_login_failed: "Intento de acceso fallido",
    skin_uploaded_admin: "Skin actualizada",
  };
  return map[action] ?? action.replace(/_/g, " ");
}

export async function buildPlayerPortal(
  session: VerifySessionResult,
  deviceId: string
): Promise<PlayerPortalDashboard | null> {
  if (!session.valid || !session.userId) return null;

  const store = await loadAuthStore();
  const user = store.users.find((u) => u.id === session.userId && !u.revoked);
  if (!user) return null;

  const username = session.username ?? user.username;
  const displayName = session.displayName ?? user.displayName ?? username;
  const rewardsState = getUserRewardsState(session.userId);
  const profile = getUserProfile(session.userId);
  const economy = getEconomy();
  const tiers = listTiers();
  const tier = tiers.find((t) => t.id === profile?.tierId) ?? tiers[0];
  const nextTier = tiers.find((t) => t.pointsRequired > (profile?.points ?? 0));
  const ban = isTempBanned(session.userId);
  const skinMeta = getSkinMeta(user.id);
  const notifications = await pollNotificationsForDevice(deviceId);
  const config = await getPublicLauncherConfig();
  const experiments = await getActiveAssignments(deviceId);
  const presences = await listPresenceRecords();
  const myPresence = presences.find((p) => p.userId === session.userId || p.deviceId === deviceId);
  const mySessions = store.sessions.filter((s) => s.userId === session.userId && !s.revoked);
  const audit = (store.auditLog ?? [])
    .filter((e) => e.meta === username || e.meta === user.id)
    .slice(-15)
    .reverse();
  const redemptions = listUserRedemptions(session.userId);
  const transactions = listUserTransactions(session.userId);
  const referrals = countReferrals(session.userId);
  const chatFlags = countChatFlags(username);
  const playMinutes = getPlayMinutesToday(session.userId);
  const preferences = getPlayerPortalPreferences(session.userId);
  const pointsChart = buildPointsChart(session.userId);
  const prefDefs = listPreferenceDefinitions();

  const sections: PlayerPortalSection[] = [
    {
      id: "portal-control-center",
      title: "Centro de control",
      category: "Sistema",
      summary: `${prefDefs.filter((d) => preferences[d.key]).length}/${prefDefs.length} activas`,
      data: {
        preferences,
        definitions: prefDefs,
        globalFeatures: {
          notificationsEnabled: config.features?.notificationsEnabled ?? true,
          integrationsEnabled: config.features?.integrationsEnabled ?? true,
          experimentsEnabled: config.features?.experimentsEnabled ?? true,
        },
      },
    },
    {
      id: "account-identity",
      title: "Identidad de cuenta",
      category: "Cuenta",
      summary: `${displayName} (@${username})`,
      data: { userId: user.id, username, displayName, email: user.email ?? null, createdAt: user.createdAt },
    },
    {
      id: "account-tier",
      title: "Plan y rango",
      category: "Cuenta",
      summary: session.tier ?? user.tier,
      data: {
        tier: session.tier ?? user.tier,
        premium: session.premium ?? false,
        tester: session.tester ?? false,
        tierName: profile?.tierName ?? tier?.name,
        tierPerks: tier?.perks ?? [],
      },
    },
    {
      id: "account-referral",
      title: "Código de referido",
      category: "Cuenta",
      summary: profile?.referralCode ?? "—",
      data: { referralCode: profile?.referralCode, referralsInvited: referrals, referralBonus: economy.referralBonus },
    },
    {
      id: "account-last-login",
      title: "Último acceso",
      category: "Cuenta",
      summary: user.lastLoginAt ?? "—",
      data: { lastLoginAt: user.lastLoginAt, lastDailyBonus: profile?.lastDailyBonus },
    },
    {
      id: "account-sessions",
      title: "Dispositivos activos",
      category: "Seguridad",
      summary: `${mySessions.length} sesiones`,
      data: {
        sessions: mySessions.map((s) => ({
          id: s.id,
          deviceId: s.deviceId,
          lastSeenAt: s.lastSeenAt,
          expiresAt: s.expiresAt,
          current: s.deviceId === deviceId,
        })),
      },
    },
    {
      id: "security-ban",
      title: "Estado de moderación",
      category: "Seguridad",
      summary: ban.banned ? "Restringido" : "OK",
      data: { banned: ban.banned, until: ban.until, reason: ban.reason, chatFlags },
    },
    {
      id: "security-audit",
      title: "Actividad reciente",
      category: "Seguridad",
      summary: `${audit.length} eventos`,
      data: { events: audit },
    },
    {
      id: "rewards-points",
      title: "Saldo de puntos",
      category: "Recompensas",
      summary: `${profile?.points ?? 0} pts`,
      data: {
        points: profile?.points ?? 0,
        lifetimePoints: profile?.lifetimePoints ?? 0,
        xpMultiplier: economy.xpMultiplier,
      },
    },
    {
      id: "rewards-tier-progress",
      title: "Progreso de rango",
      category: "Recompensas",
      summary: nextTier ? `→ ${nextTier.name}` : "Rango máximo",
      data: {
        currentTier: tier?.name,
        currentRequired: tier?.pointsRequired ?? 0,
        nextTier: nextTier?.name,
        nextRequired: nextTier?.pointsRequired,
        progressPercent: nextTier
          ? Math.min(100, Math.round(((profile?.points ?? 0) / nextTier.pointsRequired) * 100))
          : 100,
      },
    },
    {
      id: "rewards-economy",
      title: "Economía del servidor",
      category: "Recompensas",
      summary: `${economy.pointsPerHour} pts/h`,
      data: economy,
    },
    {
      id: "rewards-daily",
      title: "Bonus diario",
      category: "Recompensas",
      summary: `${economy.dailyBonus} pts`,
      data: {
        dailyBonus: economy.dailyBonus,
        lastClaimed: profile?.lastDailyBonus,
        canClaimToday: profile?.lastLoginDate !== dayKey(),
      },
    },
    {
      id: "rewards-transactions",
      title: "Historial de puntos",
      category: "Recompensas",
      summary: `${transactions.length} movimientos`,
      data: { transactions, chart: pointsChart },
    },
    {
      id: "rewards-shop",
      title: "Tienda de canje",
      category: "Recompensas",
      summary: `${listRedeemables().filter((r) => r.active).length} items`,
      data: { redeemables: listRedeemables().filter((r) => r.active) },
    },
    {
      id: "rewards-inventory",
      title: "Inventario canjeado",
      category: "Recompensas",
      summary: `${redemptions.length} items`,
      data: { items: redemptions },
    },
    {
      id: "rewards-referrals",
      title: "Referidos conseguidos",
      category: "Recompensas",
      summary: `${referrals} amigos`,
      data: { count: referrals, bonusPerReferral: economy.referralBonus },
    },
    {
      id: "missions-active",
      title: "Misiones activas",
      category: "Misiones",
      summary: `${rewardsState?.missions.filter((m) => !m.completed).length ?? 0} en curso`,
      data: { missions: rewardsState?.missions ?? [] },
    },
    {
      id: "missions-completed",
      title: "Misiones completadas",
      category: "Misiones",
      summary: `${rewardsState?.missions.filter((m) => m.completed).length ?? 0} hechas`,
      data: {
        completed: rewardsState?.missions.filter((m) => m.completed) ?? [],
        total: rewardsState?.missions.length ?? 0,
      },
    },
    {
      id: "missions-daily",
      title: "Misiones diarias",
      category: "Misiones",
      summary: "Reset cada 24h",
      data: { missions: rewardsState?.missions.filter((m) => m.type === "daily") ?? [] },
    },
    {
      id: "missions-weekly",
      title: "Misiones semanales",
      category: "Misiones",
      summary: "Reset semanal",
      data: { missions: rewardsState?.missions.filter((m) => m.type === "weekly") ?? [] },
    },
    {
      id: "missions-special",
      title: "Misiones especiales",
      category: "Misiones",
      summary: "Eventos limitados",
      data: { missions: rewardsState?.missions.filter((m) => m.type === "special") ?? [] },
    },
    {
      id: "notifications-inbox",
      title: "Notificaciones",
      category: "Comunicación",
      summary: `${notifications.length} sin leer`,
      data: { unread: notifications, count: notifications.length },
    },
    {
      id: "notifications-server",
      title: "Estado del servidor",
      category: "Comunicación",
      summary: config.maintenanceMode ? "Mantenimiento" : "Operativo",
      data: {
        maintenanceMode: config.maintenanceMode,
        maintenanceMessage: config.maintenanceMessage,
        serverName: config.serverName,
        supportUrl: config.supportUrl,
      },
    },
    {
      id: "launcher-presence",
      title: "Estado en launcher",
      category: "Launcher",
      summary: myPresence?.status ?? "offline",
      data: myPresence
        ? {
            status: myPresence.status,
            launcherVersion: myPresence.launcherVersion,
            minecraftVersion: myPresence.minecraftVersion,
            os: myPresence.os,
            country: myPresence.country,
            city: myPresence.city,
            ramUsage: myPresence.ramUsage,
            cpuUsage: myPresence.cpuUsage,
            health: myPresence.health,
            lastSeenAt: myPresence.lastSeenAt,
          }
        : { status: "offline" },
    },
    {
      id: "launcher-devices",
      title: "Dispositivos conectados",
      category: "Launcher",
      summary: `${presences.filter((p) => p.userId === session.userId).length} online`,
      data: {
        devices: presences
          .filter((p) => p.userId === session.userId)
          .map((p) => ({
            deviceId: p.deviceId,
            status: p.status,
            os: p.os,
            launcherVersion: p.launcherVersion,
            lastSeenAt: p.lastSeenAt,
          })),
      },
    },
    {
      id: "launcher-version",
      title: "Versión del launcher",
      category: "Launcher",
      summary: myPresence?.launcherVersion ?? config.minLauncherVersion,
      data: {
        current: myPresence?.launcherVersion,
        minRequired: config.minLauncherVersion,
        latest: config.latestLauncherVersion,
        forceUpdate: config.forceUpdate,
      },
    },
    {
      id: "launcher-config",
      title: "Configuración remota",
      category: "Launcher",
      summary: config.serverName,
      data: {
        apiUrl: config.apiUrl,
        wsUrl: config.wsUrl,
        features: config.features,
        oauthMode: config.oauthMode,
      },
    },
    {
      id: "playtime-today",
      title: "Tiempo jugado hoy",
      category: "Actividad",
      summary: `${playMinutes} min`,
      data: {
        minutesToday: playMinutes,
        pointsPerHour: economy.pointsPerHour,
        estimatedPoints: Math.floor((playMinutes / 60) * economy.pointsPerHour),
      },
    },
    {
      id: "playtime-minecraft",
      title: "Versión de Minecraft",
      category: "Actividad",
      summary: myPresence?.minecraftVersion ?? "—",
      data: { version: myPresence?.minecraftVersion, status: myPresence?.status },
    },
    {
      id: "profile-skin",
      title: "Skin de Minecraft",
      category: "Perfil",
      summary: skinExists(user.id) ? "Personalizada" : "Por defecto",
      data: {
        hasSkin: skinExists(user.id),
        updatedAt: skinMeta?.updatedAt,
        url: skinMeta ? `/api/launcher-auth/skins/${user.id}` : null,
      },
    },
    {
      id: "profile-display",
      title: "Perfil público",
      category: "Perfil",
      summary: displayName,
      data: {
        displayName,
        username,
        tier: profile?.tierName,
        referralCode: profile?.referralCode,
      },
    },
    {
      id: "experiments-ab",
      title: "Experimentos A/B",
      category: "Personalización",
      summary: `${experiments.length} activos`,
      data: { assignments: experiments },
    },
    {
      id: "perks-tier",
      title: "Ventajas del rango",
      category: "Personalización",
      summary: tier?.name ?? "—",
      data: { perks: tier?.perks ?? [], allTiers: tiers.map((t) => ({ name: t.name, required: t.pointsRequired, perks: t.perks })) },
    },
    {
      id: "achievements",
      title: "Logros",
      category: "Personalización",
      summary: "Desbloqueos automáticos",
      data: {
        badges: [
          ...(profile?.lifetimePoints && profile.lifetimePoints >= 500 ? ["Artesano en camino"] : []),
          ...(profile?.lifetimePoints && profile.lifetimePoints >= 2000 ? ["Leyenda"] : []),
          ...(referrals >= 1 ? ["Reclutador"] : []),
          ...(rewardsState?.missions.filter((m) => m.completed).length ? ["Misionero"] : []),
          ...(session.premium ? ["Premium"] : []),
        ],
        missionsCompleted: rewardsState?.missions.filter((m) => m.completed).length ?? 0,
      },
    },
    {
      id: "chat-moderation",
      title: "Historial chat",
      category: "Social",
      summary: `${chatFlags} flags`,
      data: { flags: chatFlags, chatEnabled: config.features?.chatEnabled ?? true },
    },
    {
      id: "social-referral-link",
      title: "Invitar amigos",
      category: "Social",
      summary: "Comparte tu código",
      data: {
        code: profile?.referralCode,
        reward: economy.referralBonus,
        invited: referrals,
      },
    },
    {
      id: "events-bonus",
      title: "Bonus por eventos",
      category: "Eventos",
      summary: `${economy.eventBonus} pts/evento`,
      data: { eventBonus: economy.eventBonus },
    },
    {
      id: "modpack-mission",
      title: "Progreso modpacks",
      category: "Contenido",
      summary: "Instalación premium",
      data: {
        mission: rewardsState?.missions.find((m) => m.metric === "modpack_install"),
      },
    },
    {
      id: "session-expiry",
      title: "Caducidad de sesión",
      category: "Seguridad",
      summary: session.expiresAt ?? "—",
      data: { expiresAt: session.expiresAt, sessionId: session.sessionId },
    },
    {
      id: "premium-benefits",
      title: "Beneficios premium",
      category: "Cuenta",
      summary: session.premium ? "Activo" : "Free",
      data: {
        premium: session.premium,
        benefits: session.premium
          ? ["Modpacks premium", "Prioridad en cola", "Capas exclusivas", "Eventos VIP"]
          : ["Actualiza a premium para desbloquear contenido exclusivo"],
      },
    },
    {
      id: "hub-sync",
      title: "Hub del launcher",
      category: "Launcher",
      summary: "Interfaz sincronizada",
      data: { synced: true, description: "Tu hub se sincroniza automáticamente al abrir el launcher" },
    },
    {
      id: "notifications-preferences",
      title: "Preferencias de avisos",
      category: "Comunicación",
      summary: config.features?.notificationsEnabled ? "Activas" : "Pausadas",
      data: { notificationsEnabled: config.features?.notificationsEnabled ?? true },
    },
    {
      id: "integrations-status",
      title: "Integraciones",
      category: "Sistema",
      summary: "Webhooks del ecosistema",
      data: { integrationsEnabled: config.features?.integrationsEnabled ?? true },
    },
    {
      id: "experiments-feature",
      title: "Features experimentales",
      category: "Sistema",
      summary: config.features?.experimentsEnabled ? "Habilitadas" : "Off",
      data: { experimentsEnabled: config.features?.experimentsEnabled ?? true },
    },
  ];

  const activityFeed = buildActivityFeed({
    transactions,
    audit,
    redemptions,
    missions: rewardsState?.missions ?? [],
    sessions: mySessions.map((s) => ({
      id: s.id,
      lastSeenAt: s.lastSeenAt,
      current: s.deviceId === deviceId,
    })),
  });

  return {
    generatedAt: new Date().toISOString(),
    player: {
      userId: session.userId,
      username,
      displayName,
      tier: session.tier ?? user.tier,
      premium: session.premium ?? false,
      tester: session.tester ?? false,
    },
    sections,
    stats: {
      totalSections: sections.length,
      points: profile?.points ?? 0,
      tierName: profile?.tierName ?? null,
      unreadNotifications: notifications.length,
      activeMissions: rewardsState?.missions.filter((m) => !m.completed).length ?? 0,
      devicesOnline: presences.filter((p) => p.userId === session.userId).length,
    },
    preferences,
    activityFeed,
    pointsChart,
  };
}
