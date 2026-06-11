"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { FilterPills } from "@/components/ui/FilterPills";
import { StatCard } from "@/components/ui/StatCard";
import { Tabs } from "@/components/ui/Tabs";
import { Avatar } from "@/components/ui/Avatar";
import { PasswordStrength } from "@/components/ui/PasswordStrength";
import { badgeDefault, rowItem } from "@/lib/styles";
import { validatePassword, passwordPolicySummary, generateSecurePassword } from "@/lib/password-policy";
import type { UserModerationIntel } from "@/lib/launcher-auth/profile-moderation";
import {
  ProfileLiveSummary,
  ProfileModerationDetail,
} from "@/components/profiles/ProfileLiveMonitor";
import {
  AUDIT_PANEL_HEIGHT,
  PROFILE_DETAIL_BODY_MIN,
  PROFILE_SCROLL,
  PROFILE_WORKSPACE_HEIGHT,
} from "@/components/profiles/profile-layout";
import {
  expiresWithin,
  formatExpiresIn,
  formatRelativeTime,
  isExpired,
} from "@/lib/utils";
import {
  AlertTriangle,
  Copy,
  ImageIcon,
  KeyRound,
  LogOut,
  Monitor,
  RefreshCw,
  Search,
  Shield,
  ShieldOff,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Wifi,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { formatModerationReport } from "@/lib/launcher-auth/profile-moderation";
import {
  PROFILE_PLANS,
  formatProfileClipboard,
  isPremiumPlan,
  profilePlanLabel,
  type ProfileClipboardData,
  type ProfilePlanId,
} from "@craftlauncher/shared";
import { copyTextToClipboard } from "@/lib/clipboard";
import { reportAppError } from "@/lib/app-errors-store";

type ProfileUser = {
  id: string;
  username: string;
  displayName?: string;
  tier?: ProfilePlanId | string;
  email?: string;
  notes?: string;
  referralCode?: string;
  createdAt: string;
  revoked: boolean;
  lastLoginAt?: string;
  activeSessionCount: number;
  totalSessionCount: number;
  hasSkin: boolean;
  skinUpdatedAt?: string;
};

type CreatedProfileBundle = ProfileClipboardData & {
  username: string;
  password: string;
};

function buildClipboardPayload(
  user: ProfileUser,
  extras?: { password?: string; activationToken?: string }
): ProfileClipboardData {
  return {
    nombre: user.username,
    contraseña: extras?.password,
    nombre_visible: user.displayName ?? user.username,
    plan: profilePlanLabel(user.tier ?? "free"),
    codigo: extras?.activationToken,
    id: user.id,
    email: user.email,
    notas: user.notes,
    referido: user.referralCode,
  };
}

async function copyProfileData(data: ProfileClipboardData): Promise<boolean> {
  return copyTextToClipboard(formatProfileClipboard(data));
}

type ProfileSession = {
  id: string;
  deviceId: string;
  label?: string;
  userId?: string;
  username?: string;
  tier?: string;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
  revoked: boolean;
  ipHint?: string;
  fingerprintPrefix?: string;
};

type AuditEntry = {
  id: string;
  action: string;
  at: string;
  ipHint?: string;
  meta?: string;
};

type OverviewStats = {
  totalUsers: number;
  activeUsers: number;
  revokedUsers: number;
  activeSessions: number;
  usersWithSkin: number;
  launchersOnline?: number;
};

const FILTER_OPTIONS = [
  { id: "all", label: "Todos" },
  { id: "live", label: "En vivo" },
  { id: "active", label: "Activos" },
  { id: "sessions", label: "Con sesión" },
  { id: "skin", label: "Con skin" },
  { id: "revoked", label: "Revocados" },
];

const CREATED_SUMMARY_MS = 10_000;

const DETAIL_TABS = [
  { id: "moderation", label: "Moderación" },
  { id: "general", label: "General" },
  { id: "sessions", label: "Sesiones" },
  { id: "skin", label: "Skin" },
  { id: "security", label: "Seguridad" },
];

const AUDIT_LABELS: Record<string, string> = {
  user_created: "Cuenta creada",
  user_revoked: "Cuenta revocada",
  user_deleted: "Perfil eliminado",
  user_restored: "Cuenta restaurada",
  user_updated: "Perfil actualizado",
  user_password_reset: "Contraseña reseteada",
  sessions_revoked_bulk: "Sesiones cerradas",
  session_revoked: "Sesión revocada",
  skin_uploaded_admin: "Skin subida (admin)",
  skin_deleted_admin: "Skin eliminada (admin)",
  user_login_success: "Login OK",
  user_login_failed: "Login fallido",
};

async function profileAction(body: Record<string, unknown>) {
  const res = await fetch("/api/launcher-auth/admin/profiles", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  let data: { success?: boolean; error?: string; count?: number; user?: ProfileUser } = {};
  if (raw.trim()) {
    try {
      data = JSON.parse(raw) as typeof data;
    } catch {
      return {
        success: false,
        error: `Respuesta inválida del servidor (${res.status}). Revisa variables en Railway.`,
      };
    }
  } else if (!res.ok) {
    return { success: false, error: `Error del servidor (${res.status}) sin detalle.` };
  }
  if (!res.ok) {
    return { success: false, error: data.error ?? `Error ${res.status}` };
  }
  return { ...data, success: data.success ?? true };
}

export function ProfileAdminPanel() {
  const [users, setUsers] = useState<ProfileUser[]>([]);
  const [sessions, setSessions] = useState<ProfileSession[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState("moderation");
  const [skinPreview, setSkinPreview] = useState<string | null>(null);
  const [skinLoading, setSkinLoading] = useState(false);

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [tier, setTier] = useState<ProfilePlanId>("free");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [generateTokenOnCreate, setGenerateTokenOnCreate] = useState(true);
  const [creating, setCreating] = useState(false);
  const [lastCreated, setLastCreated] = useState<CreatedProfileBundle | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [moderation, setModeration] = useState<UserModerationIntel[]>([]);
  const [deletingProfile, setDeletingProfile] = useState(false);
  const createdSummaryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleCreatedSummaryDismiss = useCallback(() => {
    if (createdSummaryTimer.current) clearTimeout(createdSummaryTimer.current);
    createdSummaryTimer.current = setTimeout(() => {
      setLastCreated(null);
      setCopyHint(null);
      createdSummaryTimer.current = null;
    }, CREATED_SUMMARY_MS);
  }, []);

  useEffect(
    () => () => {
      if (createdSummaryTimer.current) clearTimeout(createdSummaryTimer.current);
    },
    []
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/launcher-auth/admin/profiles", { credentials: "include" });
      const data = (await res.json()) as {
        authenticated?: boolean;
        users?: ProfileUser[];
        sessions?: ProfileSession[];
        auditLog?: AuditEntry[];
        moderation?: UserModerationIntel[];
        stats?: OverviewStats;
        error?: string;
      };
      setAuthenticated(Boolean(data.authenticated));
      setUsers(data.users ?? []);
      setSessions(data.sessions ?? []);
      setAuditLog(data.auditLog ?? []);
      setModeration(data.moderation ?? []);
      setStats(data.stats ?? null);
      if (!data.authenticated) {
        reportAppError("Inicia sesión en Acceso Launcher para gestionar perfiles.");
      }
    } catch {
      reportAppError("Error de red al cargar perfiles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (filter !== "live") return;
    const timer = setInterval(() => void refresh(), 12_000);
    return () => clearInterval(timer);
  }, [filter, refresh]);

  const moderationByUserId = useMemo(() => {
    const map = new Map<string, UserModerationIntel>();
    for (const m of moderation) map.set(m.userId, m);
    return map;
  }, [moderation]);

  const filtered = useMemo(() => {
    let list = users;
    if (filter === "live") {
      list = list.filter((u) => {
        const intel = moderationByUserId.get(u.id);
        return intel?.launcherOpen || (intel?.activeSessionCount ?? 0) > 0;
      });
    }
    if (filter === "active") list = list.filter((u) => !u.revoked);
    if (filter === "revoked") list = list.filter((u) => u.revoked);
    if (filter === "sessions") list = list.filter((u) => u.activeSessionCount > 0);
    if (filter === "skin") list = list.filter((u) => u.hasSkin);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          (u.displayName ?? "").toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q)
      );
    }
    return list;
  }, [users, filter, search, moderationByUserId]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return filtered.find((u) => u.id === selectedId) ?? null;
  }, [filtered, selectedId]);

  useEffect(() => {
    if (selectedId && !filtered.some((u) => u.id === selectedId)) {
      setSelectedId(null);
    }
  }, [filtered, selectedId]);

  const selectedIntel = useMemo(
    () => (selected ? moderationByUserId.get(selected.id) ?? null : null),
    [selected, moderationByUserId]
  );

  const userSessions = useMemo(() => {
    if (!selected) return [];
    return sessions
      .filter((s) => s.userId === selected.id)
      .sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt));
  }, [sessions, selected]);

  const liveModerationItems = useMemo(
    () => moderation.filter((m) => m.launcherOpen || m.activeSessionCount > 0),
    [moderation]
  );

  const selectUser = (id: string) => {
    setSelectedId(id);
    setDetailTab("moderation");
  };

  useEffect(() => {
    if (!selected?.hasSkin) {
      setSkinPreview(null);
      return;
    }
    let cancelled = false;
    setSkinLoading(true);
    void fetch(`/api/launcher-auth/admin/skins?userId=${selected.id}&include=image`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d: { dataUrl?: string }) => {
        if (!cancelled) setSkinPreview(d.dataUrl ?? null);
      })
      .catch(() => {
        if (!cancelled) setSkinPreview(null);
      })
      .finally(() => {
        if (!cancelled) setSkinLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.id, selected?.hasSkin]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const policy = validatePassword(password, {
      username: username.trim(),
      displayName: (displayName || username).trim(),
    });
    if (!username.trim() || !policy.valid) return;

    const trimmedUsername = username.trim();
    const trimmedDisplayName = (displayName || username).trim();
    const savedPassword = password;
    const savedTier = tier;
    const savedEmail = email.trim() || undefined;
    const savedNotes = notes.trim() || undefined;
    const savedReferral = referralCode.trim() || undefined;

    setCreating(true);
    setLastCreated(null);
    setCopyHint(null);
    if (createdSummaryTimer.current) clearTimeout(createdSummaryTimer.current);

    try {
      const data = await profileAction({
        username: trimmedUsername,
        displayName: trimmedDisplayName,
        password: savedPassword,
        tier: savedTier,
        email: savedEmail,
        notes: savedNotes,
        referralCode: savedReferral,
      });
      if (!data.success) {
        reportAppError(data.error ?? "No se pudo crear la cuenta");
        return;
      }

      setUsername("");
      setDisplayName("");
      setPassword("");
      setEmail("");
      setNotes("");
      setReferralCode("");
      setTier("free");

      let activationToken: string | undefined;
      if (generateTokenOnCreate) {
        try {
          const tokenRes = await fetch("/api/launcher-auth/admin/tokens", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              label: trimmedDisplayName,
              tier: isPremiumPlan(savedTier) ? "premium" : "free",
            }),
          });
          const tokenRaw = await tokenRes.text();
          const tokenData = tokenRaw.trim()
            ? (JSON.parse(tokenRaw) as { token?: { token: string }; error?: string })
            : {};
          if (tokenRes.ok && tokenData.token?.token) {
            activationToken = tokenData.token.token;
          } else if (!tokenRes.ok) {
            setCopyHint(
              `Cuenta creada, pero no se generó el token: ${tokenData.error ?? `error ${tokenRes.status}`}`
            );
          }
        } catch {
          setCopyHint("Cuenta creada, pero falló la generación del token de activación.");
        }
      }

      const createdUser: ProfileUser = data.user ?? {
        id: "",
        username: trimmedUsername,
        displayName: trimmedDisplayName,
        tier: savedTier,
        email: savedEmail,
        notes: savedNotes,
        referralCode: savedReferral,
        createdAt: new Date().toISOString(),
        revoked: false,
        activeSessionCount: 0,
        totalSessionCount: 0,
        hasSkin: false,
      };

      const bundle: CreatedProfileBundle = {
        ...buildClipboardPayload(createdUser, { password: savedPassword, activationToken }),
        username: trimmedUsername,
        password: savedPassword,
      };
      setLastCreated(bundle);
      scheduleCreatedSummaryDismiss();
      const copied = await copyProfileData(bundle);
      setCopyHint(
        copied
          ? "Datos copiados al portapapeles — pégalos en el launcher con «Importar credenciales»."
          : "Cuenta creada. Selecciona y copia manualmente el bloque de abajo (Ctrl+C)."
      );

      await refresh();
    } catch {
      reportAppError("Error de red al crear la cuenta");
    } finally {
      setCreating(false);
    }
  };

  const saveUser = async (u: ProfileUser) => {
    const data = await profileAction({
      action: "update",
      id: u.id,
      displayName: (u.displayName || u.username).trim(),
      tier: u.tier ?? "free",
      email: u.email,
      notes: u.notes,
      referralCode: u.referralCode,
    });
    if (!data.success) reportAppError(data.error ?? "No se pudo guardar");
    await refresh();
  };

  const uploadSkin = (userId: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const image = reader.result as string;
        setSkinLoading(true);
        const res = await fetch("/api/launcher-auth/admin/skins", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, image }),
        });
        const data = (await res.json()) as { success?: boolean; error?: string };
        if (!data.success) reportAppError(data.error ?? "No se pudo subir la skin");
        await refresh();
        setSkinLoading(false);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const deleteProfile = async (user: ProfileUser) => {
    const confirmText = prompt(
      `Eliminar permanentemente a @${user.username}.\n\nSe borrarán sesiones y skin. Escribe el usuario para confirmar:`
    );
    if (confirmText?.trim().toLowerCase() !== user.username.toLowerCase()) {
      if (confirmText !== null) reportAppError("Confirmación incorrecta — no se eliminó el perfil.");
      return;
    }
    setDeletingProfile(true);
    try {
      const data = await profileAction({ action: "delete", id: user.id });
      if (!data.success) {
        reportAppError(data.error ?? "No se pudo eliminar el perfil");
        return;
      }
      if (selectedId === user.id) setSelectedId(null);
      await refresh();
    } catch {
      reportAppError("Error de red al eliminar el perfil");
    } finally {
      setDeletingProfile(false);
    }
  };

  const deleteSkin = async (userId: string) => {
    if (!confirm("¿Eliminar la skin de este usuario?")) return;
    setSkinLoading(true);
    const res = await fetch("/api/launcher-auth/admin/skins", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", userId }),
    });
    const data = (await res.json()) as { success?: boolean };
    if (!data.success) reportAppError("No se pudo eliminar la skin");
    setSkinPreview(null);
    await refresh();
    setSkinLoading(false);
  };

  if (!authenticated) {
    return (
      <Card className="border-amber-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-amber-400" />
            Acceso restringido
          </CardTitle>
          <CardDescription>
            Ve a <strong>Control → Acceso Launcher</strong>, inicia sesión como admin y vuelve aquí.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-muted)]">
          Control de cuentas, moderación en vivo y sesiones del launcher.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={moderation.length === 0}
            onClick={() => {
              const text = moderation.map((m) => formatModerationReport(m)).join("\n\n---\n\n");
              void copyTextToClipboard(text);
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            Exportar informes
          </Button>
          <Link href="/live-ops">
            <Button variant="outline" size="sm">
              <Monitor className="h-3.5 w-3.5" />
              Live Ops
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {copyHint && !lastCreated && <p className="text-sm text-emerald-300">{copyHint}</p>}

      <div className="grid min-h-[5.5rem] shrink-0 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard title="Cuentas" value={stats?.totalUsers ?? "—"} icon={Users} />
        <StatCard title="Activas" value={stats?.activeUsers ?? "—"} icon={Shield} />
        <StatCard title="Launchers en vivo" value={stats?.launchersOnline ?? 0} icon={Wifi} />
        <StatCard title="Sesiones vivas" value={stats?.activeSessions ?? "—"} icon={Monitor} />
        <StatCard title="Con skin" value={stats?.usersWithSkin ?? "—"} icon={ImageIcon} />
        <StatCard title="Revocadas" value={stats?.revokedUsers ?? "—"} icon={ShieldOff} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Crear perfil / cuenta
          </CardTitle>
          <CardDescription>Nueva cuenta de launcher con usuario y contraseña</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(e) => void handleCreate(e)}>
            <Input label="Usuario" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="jugador1" autoComplete="off" />
            <div className="space-y-1.5">
              <Input
                label="Contraseña"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={passwordPolicySummary()}
                autoComplete="new-password"
              />
              <PasswordStrength
                password={password}
                username={username}
                displayName={displayName || username}
              />
            </div>
            <Input label="Nombre visible" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Opcional" />
            <Select
              label="Plan"
              value={tier}
              onChange={(e) => setTier(e.target.value as ProfilePlanId)}
              options={PROFILE_PLANS.map((p) => ({ value: p.id, label: p.label }))}
            />
            <Input
              label="Email (opcional)"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jugador@email.com"
              autoComplete="off"
            />
            <Input
              label="Código referido (opcional)"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              placeholder="REF-2026"
              autoComplete="off"
            />
            <Input
              label="Notas internas (opcional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Moderación, origen, etc."
              className="sm:col-span-2"
            />
            <label className="flex items-center gap-2 text-xs text-[var(--color-text-soft)] sm:col-span-2 lg:col-span-4">
              <input
                type="checkbox"
                checked={generateTokenOnCreate}
                onChange={(e) => setGenerateTokenOnCreate(e.target.checked)}
                className="rounded border-[var(--color-border)]"
              />
              Generar token de activación y copiarlo en el bloque de credenciales
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
              <Button
                type="submit"
                disabled={
                  creating ||
                  !username.trim() ||
                  !validatePassword(password, {
                    username: username.trim(),
                    displayName: (displayName || username).trim(),
                  }).valid
                }
              >
                <KeyRound className="h-3.5 w-3.5" />
                {creating ? "Creando…" : "Crear cuenta"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPassword(generateSecurePassword())}
                title="Generar contraseña segura aleatoria"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Generar contraseña
              </Button>
            </div>
          </form>
          {copyHint && <p className="mt-3 text-xs text-emerald-300">{copyHint}</p>}
          {lastCreated && (
            <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
              <p className="font-medium text-emerald-200">
                Cuenta creada
                <span className="ml-2 text-xs font-normal text-emerald-300/70">
                  (desaparece en unos segundos)
                </span>
              </p>
              <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-black/30 p-2 font-mono text-[11px] text-emerald-100/90">
                {formatProfileClipboard(lastCreated)}
              </pre>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  void copyProfileData(lastCreated).then((ok) =>
                    setCopyHint(
                      ok
                        ? "Datos copiados al portapapeles."
                        : "No se pudo copiar automáticamente. Selecciona el texto del bloque y usa Ctrl+C."
                    )
                  );
                }}
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar datos para el launcher
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative min-w-[200px] flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" strokeWidth={1.5} />
          <Input placeholder="Buscar usuario, nombre o ID…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <FilterPills options={FILTER_OPTIONS} active={filter} onChange={setFilter} />
      </div>

      <div className="shrink-0 space-y-4">
      <div
        className={`grid items-stretch gap-4 lg:grid-cols-5 ${PROFILE_WORKSPACE_HEIGHT}`}
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--color-border-subtle)] lg:col-span-2">
          {filter === "live" && (
            <div className="shrink-0 space-y-1 border-b border-[var(--color-border-subtle)] px-3 py-2.5">
              <p className="flex items-center gap-2 text-sm font-medium text-[var(--color-text)]">
                <Wifi className="h-4 w-4 text-emerald-400" />
                Monitoreo en vivo
              </p>
              <ProfileLiveSummary items={liveModerationItems} />
              <p className="text-[10px] text-[var(--color-muted)]">
                Heartbeat 45 s · actualiza cada 12 s
              </p>
            </div>
          )}
          <div className={`min-h-0 flex-1 space-y-2 p-2 ${PROFILE_SCROLL}`}>
            {filtered.length === 0 ? (
              <div className="flex h-full min-h-[20rem] items-center justify-center p-4 text-center text-sm text-[var(--color-muted)]">
                Ningún perfil coincide con el filtro.
              </div>
            ) : (
              filtered.map((user) => {
                const intel = moderationByUserId.get(user.id);
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => selectUser(user.id)}
                    className={`w-full text-left ${rowItem} ${
                      selected?.id === user.id
                        ? "border-[var(--color-accent-muted)] bg-[var(--color-accent-soft)]/20"
                        : ""
                    } ${user.revoked ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <Avatar name={user.displayName ?? user.username} size="md" />
                        {intel?.launcherOpen && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--color-surface)] bg-emerald-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm text-[var(--color-text)]">@{user.username}</p>
                          {user.tier && user.tier !== "free" && (
                            <Badge className={badgeDefault}>{profilePlanLabel(user.tier)}</Badge>
                          )}
                          {user.revoked && <Badge className="bg-red-500/20 text-red-300">Revocado</Badge>}
                          {intel?.launcherOpen && (
                            <Badge className="bg-emerald-500/15 text-emerald-300">En vivo</Badge>
                          )}
                          {user.activeSessionCount > 0 && (
                            <Badge className="bg-sky-500/15 text-sky-200">
                              {user.activeSessionCount} sesión
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-[var(--color-text-soft)]">
                          {intel?.primaryIp ? `IP ${intel.primaryIp}` : user.displayName ?? user.username}
                        </p>
                        <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                          {intel?.launcherStatusLabel ??
                            (user.lastLoginAt
                              ? `Visto ${formatRelativeTime(user.lastLoginAt)}`
                              : "Sin actividad reciente")}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <Card className="flex h-full min-h-0 flex-col overflow-hidden lg:col-span-3">
          <CardHeader className="shrink-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {selected ? (
                  <Avatar name={selected.displayName ?? selected.username} size="lg" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-[var(--color-border-subtle)]">
                    <Users className="h-5 w-5 text-[var(--color-muted)] opacity-50" />
                  </div>
                )}
                <div>
                  <CardTitle>{selected ? `@${selected.username}` : "Ficha de usuario"}</CardTitle>
                  <CardDescription>
                    {selected
                      ? `${selectedIntel?.launcherOpen
                          ? `${selectedIntel.launcherStatusLabel} · ${selectedIntel.primaryIp ?? "IP —"}`
                          : selected.revoked
                            ? "Cuenta revocada"
                            : "Launcher cerrado"} · ID ${selected.id.slice(0, 16)}…`
                      : "Selecciona un perfil de la lista para ver todos los datos"}
                  </CardDescription>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {selected && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void copyProfileData(buildClipboardPayload(selected)).then((ok) =>
                        setCopyHint(
                          ok
                            ? "Datos del perfil copiados (sin contraseña)."
                            : "No se pudo copiar automáticamente. Usa Ctrl+C sobre el texto."
                        )
                      );
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copiar datos
                  </Button>
                )}
                <Tabs tabs={DETAIL_TABS} active={detailTab} onChange={setDetailTab} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col p-0">
            <div className={`min-h-0 flex-1 p-6 ${PROFILE_SCROLL}`}>
              <div className={PROFILE_DETAIL_BODY_MIN}>
              {!selected ? (
                <div className="flex h-full min-h-[24rem] flex-col items-center justify-center text-center">
                  <Users className="mb-3 h-10 w-10 text-[var(--color-muted)] opacity-40" />
                  <p className="text-sm text-[var(--color-text-soft)]">
                    {filtered.length === 0
                      ? "Ningún usuario en este filtro. Elige otro o crea una cuenta."
                      : "Haz clic en un usuario de la lista para ver moderación, sesiones y seguridad."}
                  </p>
                </div>
              ) : (
              <>
              {detailTab === "moderation" && selectedIntel && (
                <ProfileModerationDetail intel={selectedIntel} />
              )}
              {detailTab === "moderation" && !selectedIntel && (
                <p className="text-sm text-[var(--color-muted)]">Sin datos de moderación para este usuario.</p>
              )}

              {detailTab === "general" && (
                <div className="space-y-4">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      { label: "Usuario", value: `@${selected.username}` },
                      { label: "ID cuenta", value: selected.id },
                      { label: "Estado", value: selected.revoked ? "Revocada" : "Activa" },
                      {
                        label: "Launcher",
                        value: selectedIntel?.launcherOpen
                          ? (selectedIntel.launcherStatusLabel ?? "Abierto")
                          : "Cerrado",
                      },
                      { label: "IP principal", value: selectedIntel?.primaryIp ?? "—" },
                      {
                        label: "Ubicación",
                        value:
                          selectedIntel?.primaryCity && selectedIntel?.primaryCountry
                            ? `${selectedIntel.primaryCity}, ${selectedIntel.primaryCountry}`
                            : "—",
                      },
                      { label: "Sesiones activas", value: String(selected.activeSessionCount) },
                      { label: "Sesiones totales", value: String(selected.totalSessionCount) },
                      { label: "Dispositivos", value: String(selectedIntel?.uniqueDeviceCount ?? "—") },
                      { label: "Skin", value: selected.hasSkin ? "Personalizada" : "Predeterminada" },
                      {
                        label: "Último acceso",
                        value: selected.lastLoginAt
                          ? formatRelativeTime(selected.lastLoginAt)
                          : "—",
                      },
                      {
                        label: "Riesgo",
                        value: selectedIntel?.riskLevel?.toUpperCase() ?? "—",
                      },
                      {
                        label: "IPs conocidas",
                        value: selectedIntel?.knownIps?.join(" · ") || "—",
                      },
                    ].map((row) => (
                      <div
                        key={row.label}
                        className="rounded-lg border border-[var(--color-border-subtle)] px-3 py-2"
                      >
                        <p className="text-[10px] uppercase text-[var(--color-muted)]">{row.label}</p>
                        <p className="mt-0.5 break-all text-xs text-[var(--color-text)]">{row.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Nombre visible"
                      value={selected.displayName ?? selected.username}
                      onChange={(e) =>
                        setUsers((prev) =>
                          prev.map((u) =>
                            u.id === selected.id ? { ...u, displayName: e.target.value } : u
                          )
                        )
                      }
                      onBlur={() => void saveUser(selected)}
                    />
                    <Select
                      label="Plan"
                      value={selected.tier ?? "free"}
                      onChange={(e) => {
                        const next = e.target.value as ProfilePlanId;
                        const updated = { ...selected, tier: next };
                        setUsers((prev) => prev.map((u) => (u.id === selected.id ? updated : u)));
                        void saveUser(updated);
                      }}
                      options={PROFILE_PLANS.map((p) => ({ value: p.id, label: p.label }))}
                    />
                    <Input
                      label="Email"
                      value={selected.email ?? ""}
                      onChange={(e) =>
                        setUsers((prev) =>
                          prev.map((u) =>
                            u.id === selected.id ? { ...u, email: e.target.value } : u
                          )
                        )
                      }
                      onBlur={() => void saveUser(selected)}
                    />
                    <Input
                      label="Código referido"
                      value={selected.referralCode ?? ""}
                      onChange={(e) =>
                        setUsers((prev) =>
                          prev.map((u) =>
                            u.id === selected.id ? { ...u, referralCode: e.target.value } : u
                          )
                        )
                      }
                      onBlur={() => void saveUser(selected)}
                    />
                    <Input
                      label="Notas internas"
                      value={selected.notes ?? ""}
                      onChange={(e) =>
                        setUsers((prev) =>
                          prev.map((u) =>
                            u.id === selected.id ? { ...u, notes: e.target.value } : u
                          )
                        )
                      }
                      onBlur={() => void saveUser(selected)}
                    />
                  </div>
                </div>
              )}

              {detailTab === "sessions" && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={selected.activeSessionCount === 0}
                      onClick={async () => {
                        const data = await profileAction({ action: "revoke-sessions", userId: selected.id });
                        if (!data.success) reportAppError("No había sesiones activas");
                        await refresh();
                      }}
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Cerrar todas las sesiones ({selected.activeSessionCount})
                    </Button>
                  </div>
                  {userSessions.length === 0 ? (
                    <p className="text-sm text-[var(--color-muted)]">Sin sesiones registradas para este usuario.</p>
                  ) : (
                    <ul className="space-y-2">
                      {userSessions.map((s) => {
                        const active = !s.revoked && !isExpired(s.expiresAt);
                        const urgent = active && expiresWithin(s.expiresAt, 7 * 24 * 60 * 60 * 1000);
                        return (
                          <li
                            key={s.id}
                            className={`rounded-xl border px-3 py-2.5 text-sm ${
                              active ? "border-[var(--color-border)]" : "border-[var(--color-border-subtle)] opacity-60"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-medium">{s.label ?? s.deviceId.slice(0, 18)}</p>
                                <p className="text-[11px] text-[var(--color-muted)]">
                                  {s.deviceId.slice(0, 24)}… · IP {s.ipHint ?? "—"}
                                  {s.fingerprintPrefix ? ` · fp ${s.fingerprintPrefix}` : ""}
                                </p>
                                <p className="text-[11px] text-[var(--color-muted)]">
                                  Visto {formatRelativeTime(s.lastSeenAt)} · {formatExpiresIn(s.expiresAt)}
                                  {urgent && (
                                    <span className="ml-2 inline-flex items-center gap-1 text-amber-400">
                                      <AlertTriangle className="h-3 w-3" /> Por expirar
                                    </span>
                                  )}
                                </p>
                              </div>
                              {active && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    await profileAction({ action: "revoke-session", sessionId: s.id });
                                    await refresh();
                                  }}
                                >
                                  Revocar
                                </Button>
                              )}
                              {!active && <Badge className={badgeDefault}>{s.revoked ? "Revocada" : "Expirada"}</Badge>}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}

              {detailTab === "skin" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start gap-4">
                    <div className="flex h-32 w-24 items-center justify-center rounded-lg border border-[var(--color-border-subtle)] bg-[#1a1d22]">
                      {skinLoading ? (
                        <span className="text-xs text-[var(--color-muted)]">Cargando…</span>
                      ) : skinPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={skinPreview} alt="Skin" className="h-full w-full object-contain image-rendering-pixelated" />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-[var(--color-muted)]" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-[var(--color-text-soft)]">
                        {selected.hasSkin
                          ? `Skin personalizada · actualizada ${selected.skinUpdatedAt ? formatRelativeTime(selected.skinUpdatedAt) : ""}`
                          : "Sin skin personalizada (Minecraft usará la predeterminada)."}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => uploadSkin(selected.id)} disabled={selected.revoked}>
                          <Upload className="h-3.5 w-3.5" />
                          {selected.hasSkin ? "Reemplazar PNG" : "Subir PNG"}
                        </Button>
                        {selected.hasSkin && (
                          <Button variant="ghost" size="sm" onClick={() => void deleteSkin(selected.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                            Eliminar skin
                          </Button>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--color-muted)]">PNG 64×32, 64×64, 128×64 o 128×128 · máx. 512 KB</p>
                    </div>
                  </div>
                </div>
              )}

              {detailTab === "security" && (
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const next = prompt(
                        `Nueva contraseña (${passwordPolicySummary()}):`
                      );
                      if (!next) return;
                      const policy = validatePassword(next, {
                        username: selected.username,
                        displayName: selected.displayName,
                      });
                      if (!policy.valid) {
                        reportAppError(policy.errors.join(" · "));
                        return;
                      }
                      const data = await profileAction({
                        action: "reset-password",
                        id: selected.id,
                        password: next,
                      });
                      if (!data.success) reportAppError(data.error ?? "No se pudo resetear");
                    }}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    Resetear contraseña
                  </Button>
                  <p className="text-[11px] text-[var(--color-muted)]">
                    Para cerrar sesiones en dispositivos usa la pestaña <strong>Sesiones</strong>.
                  </p>
                  {selected.revoked ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        await profileAction({ action: "restore", id: selected.id });
                        await refresh();
                      }}
                    >
                      <Shield className="h-3.5 w-3.5" />
                      Restaurar cuenta
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-amber-400 hover:text-amber-300"
                      onClick={async () => {
                        if (!confirm(`¿Revocar la cuenta @${selected.username}? Cerrará acceso al launcher.`)) return;
                        await profileAction({ action: "revoke", id: selected.id });
                        await refresh();
                      }}
                    >
                      <ShieldOff className="h-3.5 w-3.5" />
                      Revocar cuenta
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300"
                    disabled={deletingProfile}
                    onClick={() => void deleteProfile(selected)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {deletingProfile ? "Eliminando…" : "Eliminar perfil"}
                  </Button>
                </div>
              )}
              </>
              )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className={`flex flex-col ${AUDIT_PANEL_HEIGHT}`}>
        <CardHeader className="shrink-0 py-3">
          <CardTitle>Auditoría reciente</CardTitle>
          <CardDescription>Eventos de seguridad relacionados con cuentas y sesiones</CardDescription>
        </CardHeader>
        <CardContent className={`min-h-0 flex-1 pt-0 ${PROFILE_SCROLL}`}>
          {auditLog.length === 0 ? (
            <p className="text-xs text-[var(--color-muted)]">Sin eventos recientes.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {auditLog.map((entry) => (
                <li key={entry.id} className="flex flex-wrap gap-2 text-[var(--color-text-soft)]">
                  <span className="text-[var(--color-muted)]">{formatRelativeTime(entry.at)}</span>
                  <span>{AUDIT_LABELS[entry.action] ?? entry.action}</span>
                  {entry.meta && <span className="font-mono text-[var(--color-muted)]">{entry.meta}</span>}
                  {entry.ipHint && <span className="text-[var(--color-muted)]">· {entry.ipHint}</span>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
