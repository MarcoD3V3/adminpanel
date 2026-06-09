"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { FilterPills } from "@/components/ui/FilterPills";
import { StatCard } from "@/components/ui/StatCard";
import { Tabs } from "@/components/ui/Tabs";
import { Avatar } from "@/components/ui/Avatar";
import { badgeDefault, rowItem } from "@/lib/styles";
import {
  expiresWithin,
  formatDate,
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
} from "lucide-react";

type ProfileUser = {
  id: string;
  username: string;
  displayName?: string;
  tier?: "free" | "premium";
  createdAt: string;
  revoked: boolean;
  lastLoginAt?: string;
  activeSessionCount: number;
  totalSessionCount: number;
  hasSkin: boolean;
  skinUpdatedAt?: string;
};

type ProfileSession = {
  id: string;
  deviceId: string;
  label?: string;
  userId?: string;
  username?: string;
  tier?: "free" | "premium";
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
  revoked: boolean;
  ipHint?: string;
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
};

const FILTER_OPTIONS = [
  { id: "all", label: "Todos" },
  { id: "active", label: "Activos" },
  { id: "sessions", label: "Con sesión" },
  { id: "skin", label: "Con skin" },
  { id: "revoked", label: "Revocados" },
];

const DETAIL_TABS = [
  { id: "general", label: "General" },
  { id: "sessions", label: "Sesiones" },
  { id: "skin", label: "Skin" },
  { id: "security", label: "Seguridad" },
];

const AUDIT_LABELS: Record<string, string> = {
  user_created: "Cuenta creada",
  user_revoked: "Cuenta revocada",
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
  return res.json() as Promise<{ success?: boolean; error?: string; count?: number }>;
}

export function ProfileAdminPanel() {
  const [users, setUsers] = useState<ProfileUser[]>([]);
  const [sessions, setSessions] = useState<ProfileSession[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [authenticated, setAuthenticated] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState("general");
  const [skinPreview, setSkinPreview] = useState<string | null>(null);
  const [skinLoading, setSkinLoading] = useState(false);

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [tier, setTier] = useState<"free" | "premium">("free");
  const [creating, setCreating] = useState(false);
  const [lastCreated, setLastCreated] = useState<{ username: string; password: string } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/launcher-auth/admin/profiles", { credentials: "include" });
      const data = (await res.json()) as {
        authenticated?: boolean;
        users?: ProfileUser[];
        sessions?: ProfileSession[];
        auditLog?: AuditEntry[];
        stats?: OverviewStats;
        error?: string;
      };
      setAuthenticated(Boolean(data.authenticated));
      setUsers(data.users ?? []);
      setSessions(data.sessions ?? []);
      setAuditLog(data.auditLog ?? []);
      setStats(data.stats ?? null);
      if (!data.authenticated) {
        setError("Inicia sesión en Acceso Launcher para gestionar perfiles.");
      }
    } catch {
      setError("Error de red al cargar perfiles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    let list = users;
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
  }, [users, filter, search]);

  const selected = useMemo(
    () => users.find((u) => u.id === selectedId) ?? filtered[0] ?? null,
    [users, selectedId, filtered]
  );

  const userSessions = useMemo(() => {
    if (!selected) return [];
    return sessions
      .filter((s) => s.userId === selected.id)
      .sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt));
  }, [sessions, selected]);

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
    if (!username.trim() || password.length < 6) return;
    setCreating(true);
    setError(null);
    setLastCreated(null);
    const data = await profileAction({
      username: username.trim(),
      displayName: (displayName || username).trim(),
      password,
      tier,
    });
    if (!data.success) {
      setError(data.error ?? "No se pudo crear la cuenta");
      setCreating(false);
      return;
    }
    setLastCreated({ username: username.trim(), password });
    setUsername("");
    setDisplayName("");
    setPassword("");
    setTier("free");
    await refresh();
    setCreating(false);
  };

  const saveUser = async (u: ProfileUser) => {
    setError(null);
    const data = await profileAction({
      action: "update",
      id: u.id,
      displayName: (u.displayName || u.username).trim(),
      tier: u.tier ?? "free",
    });
    if (!data.success) setError(data.error ?? "No se pudo guardar");
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
        if (!data.success) setError(data.error ?? "No se pudo subir la skin");
        await refresh();
        setSkinLoading(false);
      };
      reader.readAsDataURL(file);
    };
    input.click();
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
    if (!data.success) setError("No se pudo eliminar la skin");
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
          Control total de cuentas, sesiones activas, skins y seguridad del launcher.
        </p>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard title="Cuentas" value={stats.totalUsers} icon={Users} />
          <StatCard title="Activas" value={stats.activeUsers} icon={Shield} />
          <StatCard title="Sesiones vivas" value={stats.activeSessions} icon={Monitor} />
          <StatCard title="Con skin" value={stats.usersWithSkin} icon={ImageIcon} />
          <StatCard title="Revocadas" value={stats.revokedUsers} icon={ShieldOff} />
        </div>
      )}

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
            <Input label="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mín. 6" />
            <Input label="Nombre visible" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Opcional" />
            <Select
              label="Plan"
              value={tier}
              onChange={(e) => setTier(e.target.value as "free" | "premium")}
              options={[
                { value: "free", label: "Free" },
                { value: "premium", label: "Premium" },
              ]}
            />
            <div className="sm:col-span-2 lg:col-span-4">
              <Button type="submit" disabled={creating || !username.trim() || password.length < 6}>
                <KeyRound className="h-3.5 w-3.5" />
                {creating ? "Creando…" : "Crear cuenta"}
              </Button>
            </div>
          </form>
          {lastCreated && (
            <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
              <p className="font-medium text-emerald-200">Cuenta creada</p>
              <p className="mt-1 font-mono text-xs">
                {lastCreated.username} / {lastCreated.password}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() =>
                  void navigator.clipboard.writeText(
                    `Usuario: ${lastCreated.username}\nContraseña: ${lastCreated.password}`
                  )
                }
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar credenciales
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

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-2 lg:col-span-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">Ningún perfil coincide con el filtro.</p>
          ) : (
            filtered.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => {
                  setSelectedId(user.id);
                  setDetailTab("general");
                }}
                className={`w-full text-left ${rowItem} ${
                  selected?.id === user.id ? "border-[var(--color-accent-muted)] bg-[var(--color-accent-soft)]/20" : ""
                } ${user.revoked ? "opacity-60" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <Avatar name={user.displayName ?? user.username} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm text-[var(--color-text)]">@{user.username}</p>
                      {user.tier === "premium" && <Badge className={badgeDefault}>Premium</Badge>}
                      {user.revoked && <Badge className="bg-red-500/20 text-red-300">Revocado</Badge>}
                      {user.activeSessionCount > 0 && (
                        <Badge className="bg-emerald-500/15 text-emerald-300">{user.activeSessionCount} sesión</Badge>
                      )}
                      {user.hasSkin && <Badge className={badgeDefault}>Skin</Badge>}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-[var(--color-text-soft)]">
                      {user.displayName ?? user.username}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                      Login {user.lastLoginAt ? formatRelativeTime(user.lastLoginAt) : "nunca"} · {user.totalSessionCount} sesiones totales
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {selected && (
          <Card className="lg:col-span-3">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar name={selected.displayName ?? selected.username} size="lg" />
                  <div>
                    <CardTitle>@{selected.username}</CardTitle>
                    <CardDescription>
                      {selected.revoked ? "Cuenta revocada" : "Cuenta activa"} · ID {selected.id}
                    </CardDescription>
                  </div>
                </div>
                <Tabs tabs={DETAIL_TABS} active={detailTab} onChange={setDetailTab} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {detailTab === "general" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Nombre visible" value={selected.displayName ?? selected.username} onChange={(e) => setUsers((prev) => prev.map((u) => (u.id === selected.id ? { ...u, displayName: e.target.value } : u)))} onBlur={() => void saveUser(selected)} />
                  <Select
                    label="Plan"
                    value={selected.tier ?? "free"}
                    onChange={(e) => {
                      const next = e.target.value as "free" | "premium";
                      const updated = { ...selected, tier: next };
                      setUsers((prev) => prev.map((u) => (u.id === selected.id ? updated : u)));
                      void saveUser(updated);
                    }}
                    options={[
                      { value: "free", label: "Free" },
                      { value: "premium", label: "Premium" },
                    ]}
                  />
                  <div className="text-xs text-[var(--color-muted)] sm:col-span-2">
                    <p>Creado: {formatDate(selected.createdAt)}</p>
                    <p>Último login: {selected.lastLoginAt ? formatDate(selected.lastLoginAt) : "—"}</p>
                    <p>Sesiones activas: {selected.activeSessionCount} / {selected.totalSessionCount}</p>
                    <p>Skin: {selected.hasSkin ? `Sí · ${selected.skinUpdatedAt ? formatRelativeTime(selected.skinUpdatedAt) : ""}` : "No"}</p>
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
                        if (!data.success) setError("No había sesiones activas");
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
                                  {s.deviceId.slice(0, 24)}… · {s.ipHint ?? "IP desconocida"}
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
                      const next = prompt("Nueva contraseña (mín. 6 caracteres):");
                      if (!next || next.length < 6) return;
                      const data = await profileAction({ action: "reset-password", id: selected.id, password: next });
                      if (!data.success) setError(data.error ?? "No se pudo resetear");
                    }}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    Resetear contraseña
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={selected.activeSessionCount === 0}
                    onClick={async () => {
                      await profileAction({ action: "revoke-sessions", userId: selected.id });
                      await refresh();
                    }}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Forzar cierre de sesión en todos los dispositivos
                  </Button>
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
                      className="text-red-400 hover:text-red-300"
                      onClick={async () => {
                        if (!confirm(`¿Revocar la cuenta @${selected.username}? Cerrará acceso al launcher.`)) return;
                        await profileAction({ action: "revoke", id: selected.id });
                        await refresh();
                      }}
                    >
                      <ShieldOff className="h-3.5 w-3.5" />
                      Revocar cuenta permanentemente
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {auditLog.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Auditoría reciente</CardTitle>
            <CardDescription>Eventos de seguridad relacionados con cuentas y sesiones</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
              {auditLog.map((entry) => (
                <li key={entry.id} className="flex flex-wrap gap-2 text-[var(--color-text-soft)]">
                  <span className="text-[var(--color-muted)]">{formatRelativeTime(entry.at)}</span>
                  <span>{AUDIT_LABELS[entry.action] ?? entry.action}</span>
                  {entry.meta && <span className="font-mono text-[var(--color-muted)]">{entry.meta}</span>}
                  {entry.ipHint && <span className="text-[var(--color-muted)]">· {entry.ipHint}</span>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
