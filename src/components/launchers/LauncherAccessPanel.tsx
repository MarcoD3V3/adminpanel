"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  FlaskConical,
  FlaskConicalOff,
  KeyRound,
  Lock,
  LogOut,
  RefreshCw,
  ScrollText,
  Shield,
  ShieldCheck,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";
import {
  isTesterTier,
  type ActivationTokenPublic,
  type DeviceSessionPublic,
  type LauncherTokenTierId,
} from "@craftlauncher/shared";

const TOKEN_TIER_OPTIONS: { value: LauncherTokenTierId; label: string }[] = [
  { value: "free", label: "Free (mods CurseForge)" },
  { value: "premium", label: "Premium (todo)" },
  { value: "tester", label: "Tester (solo nombre MC)" },
];
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatExpiresIn, formatRelativeTime, expiresWithin, isExpired } from "@/lib/utils";
import {
  DEV_ADMIN_FALLBACK_KEY,
  readAdminRememberPreference,
  writeAdminRememberPreference,
} from "@/lib/admin-session-client";
import { reportAppError } from "@/lib/app-errors-store";
import { copyTextToClipboard } from "@/lib/clipboard";
import { Toggle } from "@/components/ui/Toggle";

const REFRESH_MS = 30_000;
const TOKEN_EXPIRING_MS = 48 * 60 * 60 * 1000;
const SESSION_EXPIRING_MS = 7 * 24 * 60 * 60 * 1000;

type OneTimeToken = {
  id: string;
  label: string;
  token: string;
  expiresAt: string;
};

type AuditEntry = {
  id: string;
  action: string;
  at: string;
  ipHint?: string;
  meta?: string;
};

const AUDIT_LABELS: Record<string, string> = {
  admin_login: "Login admin",
  admin_login_failed: "Login fallido",
  token_created: "Token creado",
  token_revoked: "Token revocado",
  session_revoked: "Sesión revocada",
  activation_success: "Activación OK",
  activation_failed: "Activación rechazada",
  session_verify_failed: "Verificación fallida",
  user_created: "Usuario creado",
  user_revoked: "Usuario revocado",
  user_restored: "Usuario restaurado",
  user_updated: "Usuario actualizado",
  user_password_reset: "Contraseña reseteada",
  sessions_revoked_bulk: "Sesiones cerradas (masivo)",
  skin_uploaded_admin: "Skin subida (admin)",
  skin_deleted_admin: "Skin eliminada (admin)",
  user_login_success: "Login OK",
  user_login_failed: "Login fallido",
  tester_mode_enabled: "Modo testeo activado",
  tester_mode_disabled: "Modo testeo desactivado",
};

const SECURITY_FEATURES = [
  "Tokens de activación de un solo uso (clakt_) — 256 bits de entropía",
  "Sesiones firmadas (clses_) vinculadas a dispositivo + huella SHA-256",
  "Hashes con pepper en servidor — nunca se guarda el token en claro",
  "Comparación timing-safe contra ataques de tiempo",
  "Rate limit en activación, verificación y login admin",
  "Cookie HttpOnly + SameSite=Strict para sesión admin (no expone la clave)",
  "CORS estricto — solo orígenes del launcher autorizados",
  "Mensajes genéricos en activación — no filtra si el token existe o expiró",
  "Auditoría de eventos críticos con IP",
];

function categorizeTokens(tokens: ActivationTokenPublic[]) {
  const active: ActivationTokenPublic[] = [];
  const expiringSoon: ActivationTokenPublic[] = [];
  const used: ActivationTokenPublic[] = [];
  const inactive: ActivationTokenPublic[] = [];

  for (const t of tokens) {
    if (t.revoked || (isExpired(t.expiresAt) && !t.usedAt)) {
      inactive.push(t);
      continue;
    }
    if (t.usedAt) {
      used.push(t);
      continue;
    }
    active.push(t);
    if (expiresWithin(t.expiresAt, TOKEN_EXPIRING_MS)) expiringSoon.push(t);
  }

  return { active, expiringSoon, used, inactive };
}

function categorizeSessions(sessions: DeviceSessionPublic[]) {
  const active: DeviceSessionPublic[] = [];
  const expiringSoon: DeviceSessionPublic[] = [];
  const inactive: DeviceSessionPublic[] = [];

  for (const s of sessions) {
    if (s.revoked || isExpired(s.expiresAt)) {
      inactive.push(s);
      continue;
    }
    active.push(s);
    if (expiresWithin(s.expiresAt, SESSION_EXPIRING_MS)) expiringSoon.push(s);
  }

  return { active, expiringSoon, inactive };
}

function SectionCard({
  title,
  description,
  count,
  icon,
  tone = "default",
  children,
  empty,
}: {
  title: string;
  description: string;
  count: number;
  icon: ReactNode;
  tone?: "default" | "warn" | "success" | "muted";
  children: ReactNode;
  empty: string;
}) {
  const toneClass =
    tone === "warn"
      ? "border-amber-500/30"
      : tone === "success"
        ? "border-emerald-500/30"
        : tone === "muted"
          ? "border-[var(--color-border-subtle)]"
          : "border-[var(--color-border-subtle)]";

  return (
    <Card className={toneClass}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <span className="mt-0.5 text-[var(--color-accent)]">{icon}</span>
            <div className="min-w-0">
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
          <Badge className="shrink-0">{count}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {count === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">{empty}</p>
        ) : (
          <ul className="space-y-2">{children}</ul>
        )}
      </CardContent>
    </Card>
  );
}

async function fetchAdminState() {
  const res = await fetch("/api/launcher-auth/admin/tokens", { credentials: "include" });
  if (!res.ok) throw new Error("fetch_failed");
  return res.json() as Promise<{
    authenticated: boolean;
    configured: boolean;
    devFallbackActive?: boolean;
    tokens: ActivationTokenPublic[];
    sessions: DeviceSessionPublic[];
    auditLog: AuditEntry[];
    testerModeEnabled?: boolean;
  }>;
}

const DEV_FALLBACK_KEY = DEV_ADMIN_FALLBACK_KEY;

export function LauncherAccessPanel() {
  const [authenticated, setAuthenticated] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [devFallbackActive, setDevFallbackActive] = useState(false);
  const [tokens, setTokens] = useState<ActivationTokenPublic[]>([]);
  const [sessions, setSessions] = useState<DeviceSessionPublic[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loginKey, setLoginKey] = useState("");
  const [rememberSession, setRememberSession] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [oneTime, setOneTime] = useState<OneTimeToken | null>(null);
  const [generating, setGenerating] = useState(false);
  const [tokenTier, setTokenTier] = useState<LauncherTokenTierId>("tester");
  const [testerUsername, setTesterUsername] = useState("");
  const [copyTokenHint, setCopyTokenHint] = useState<string | null>(null);
  const [testerModeEnabled, setTesterModeEnabled] = useState(false);
  const [togglingTesterMode, setTogglingTesterMode] = useState(false);

  const tokenGroups = useMemo(() => categorizeTokens(tokens), [tokens]);
  const sessionGroups = useMemo(() => categorizeSessions(sessions), [sessions]);

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) {
      setLoading(true);
    }
    try {
      const data = await fetchAdminState();
      setAuthenticated(data.authenticated);
      setConfigured(data.configured);
      setDevFallbackActive(Boolean(data.devFallbackActive));
      setTesterModeEnabled(data.testerModeEnabled === true);
      if (data.authenticated) {
        setTokens(data.tokens);
        setSessions(data.sessions);
        setAuditLog(data.auditLog);
      }
    } catch {
      if (!silent) reportAppError("No se pudo conectar con el servidor.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setRememberSession(readAdminRememberPreference());
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!authenticated) return;
    const timer = setInterval(() => void refresh({ silent: true }), REFRESH_MS);
    return () => clearInterval(timer);
  }, [authenticated, refresh]);

  useEffect(() => {
    if (testerModeEnabled && !isTesterTier(tokenTier)) {
      setTokenTier("tester");
      return;
    }
    if (!testerModeEnabled && isTesterTier(tokenTier)) {
      setTokenTier("free");
    }
  }, [testerModeEnabled, tokenTier]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    try {
      const res = await fetch("/api/launcher-auth/admin/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: loginKey, remember: rememberSession }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        const base = data.error ?? "Acceso denegado";
        reportAppError(
          base === "Clave incorrecta"
            ? `${base}. Usa exactamente LAUNCHER_ADMIN_SECRET de .env.local y reinicia npm run dev si acabas de crearlo.`
            : base
        );
        return;
      }
      setLoginKey("");
      await refresh();
    } catch {
      reportAppError("Error de red");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleToggleTesterMode = async (enabled: boolean) => {
    setTogglingTesterMode(true);
    try {
      const res = await fetch("/api/launcher-auth/access-settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const data = (await res.json()) as { success?: boolean; testerModeEnabled?: boolean; error?: string };
      if (!res.ok || !data.success) {
        reportAppError(data.error ?? "No se pudo cambiar el modo testeo.");
        return;
      }
      setTesterModeEnabled(data.testerModeEnabled === true);
      if (!enabled) {
        setOneTime(null);
        if (isTesterTier(tokenTier)) setTokenTier("free");
      }
      await refresh({ silent: true });
    } catch {
      reportAppError("Error de red al cambiar modo testeo.");
    } finally {
      setTogglingTesterMode(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/launcher-auth/admin/login", { method: "DELETE", credentials: "include" });
    setAuthenticated(false);
    setTokens([]);
    setSessions([]);
    setAuditLog([]);
    setOneTime(null);
  };

  const handleGenerate = async () => {
    if (isTesterTier(tokenTier) && !testerUsername.trim()) {
      reportAppError("Escribe el nombre de Minecraft para el token tester.");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/launcher-auth/admin/tokens", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: tokenTier,
          minecraftUsername: isTesterTier(tokenTier) ? testerUsername.trim() : undefined,
        }),
      });
      const data = (await res.json()) as { success?: boolean; token?: OneTimeToken; error?: string };
      if (!res.ok || !data.success || !data.token) {
        reportAppError(data.error ?? "No se pudo generar el token.");
        return;
      }
      setOneTime(data.token);
      setCopyTokenHint(null);
      if (isTesterTier(tokenTier)) setTesterUsername("");
      await refresh();
    } catch {
      reportAppError("Error de red");
    } finally {
      setGenerating(false);
    }
  };

  const adminAction = async (body: Record<string, string>) => {
    await fetch("/api/launcher-auth/admin/tokens", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await refresh();
  };

  if (loading && !authenticated) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-[var(--color-muted)]">
          Verificando sesión…
        </CardContent>
      </Card>
    );
  }

  const testerModeStatusCard = (
    <Card
      className={
        testerModeEnabled
          ? "border-violet-500/30 bg-violet-500/5"
          : "border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)]/40"
      }
    >
      <CardContent className="flex items-start gap-3 py-4">
        {testerModeEnabled ? (
          <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" />
        ) : (
          <FlaskConicalOff className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-muted)]" />
        )}
        <div>
          <p className="text-sm font-medium text-[var(--color-text)]">
            Modo testeo:{" "}
            <span className={testerModeEnabled ? "text-violet-300" : "text-[var(--color-muted)]"}>
              {testerModeEnabled ? "Activado" : "Desactivado"}
            </span>
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-soft)]">
            {authenticated
              ? testerModeEnabled
                ? "El launcher muestra «Modo testeo» + «Cuenta» y acepta tokens tester."
                : "El launcher solo muestra inicio de sesión. Los tokens tester no funcionan."
              : "Inicia sesión como admin para activar o desactivar el acceso de prueba en el launcher."}
          </p>
        </div>
      </CardContent>
    </Card>
  );

  if (!authenticated) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        {testerModeStatusCard}
        <Card className="border-[var(--color-accent-muted)]/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-[var(--color-accent)]" />
              <CardTitle>Acceso restringido</CardTitle>
            </div>
            <CardDescription>
              Zona protegida. La clave admin se valida en el servidor y se guarda en una cookie
              HttpOnly — nunca en el navegador en texto plano.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!configured && (
              <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                Configura LAUNCHER_ADMIN_SECRET (mín. 16 caracteres) en .env.local
              </p>
            )}
            {configured && (
              <p className="mb-4 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-100">
                {devFallbackActive ? (
                  <>
                    Sin <code className="text-xs">.env.local</code>: clave de desarrollo{" "}
                    <code className="text-xs break-all">{DEV_FALLBACK_KEY}</code>
                  </>
                ) : (
                  <>
                    Clave en <code className="text-xs">.env.local</code> →{" "}
                    <code className="text-xs">LAUNCHER_ADMIN_SECRET</code>. Si acabas de crear el
                    archivo, reinicia <code className="text-xs">npm run dev</code>.
                  </>
                )}
              </p>
            )}
            <form className="space-y-4" onSubmit={(e) => void handleLogin(e)}>
              <Input
                label="Clave admin del servidor"
                type="password"
                autoComplete="current-password"
                value={loginKey}
                onChange={(e) => setLoginKey(e.target.value)}
                placeholder="LAUNCHER_ADMIN_SECRET"
              />
              <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--color-text-soft)]">
                <input
                  type="checkbox"
                  checked={rememberSession}
                  onChange={(e) => {
                    setRememberSession(e.target.checked);
                    writeAdminRememberPreference(e.target.checked);
                  }}
                  className="rounded border-[var(--color-border-subtle)]"
                />
                Mantener sesión (30 días o hasta cerrar sesión)
              </label>
              <Button type="submit" disabled={loggingIn || !loginKey.trim() || !configured}>
                <ShieldCheck className="h-3.5 w-3.5" />
                {loggingIn ? "Verificando…" : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Protecciones activas</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-[var(--color-text-soft)]">
              {SECURITY_FEATURES.slice(0, 5).map((f) => (
                <li key={f} className="flex gap-2">
                  <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
                  {f}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card
        className={
          testerModeEnabled
            ? "border-violet-500/30 bg-violet-500/5"
            : "border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)]/40"
        }
      >
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {testerModeEnabled ? (
              <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" />
            ) : (
              <FlaskConicalOff className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-muted)]" />
            )}
            <div>
              <p className="text-sm font-medium text-[var(--color-text)]">
                Modo testeo:{" "}
                <span className={testerModeEnabled ? "text-violet-300" : "text-[var(--color-muted)]"}>
                  {testerModeEnabled ? "Activado" : "Desactivado"}
                </span>
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-soft)]">
                {testerModeEnabled
                  ? "El launcher muestra «Modo testeo» + «Cuenta» y acepta tokens tester."
                  : "El launcher solo muestra inicio de sesión normal. Los tokens tester no funcionan."}
              </p>
            </div>
          </div>
          <div className={togglingTesterMode ? "pointer-events-none opacity-50" : ""}>
            <Toggle
              checked={testerModeEnabled}
              onChange={(v) => void handleToggleTesterMode(v)}
              label={testerModeEnabled ? "Desactivar" : "Activar"}
              compact
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-emerald-400">
          <ShieldCheck className="h-4 w-4" />
          Sesión admin activa · actualización cada 30 s
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void handleLogout()}>
            <LogOut className="h-3.5 w-3.5" /> Salir
          </Button>
        </div>
      </div>


      <section className="space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
          Generación automática (tokens)
        </h2>
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Zap className="mt-0.5 h-4 w-4 text-[var(--color-accent)]" />
                <div>
                  <CardTitle>
                    {isTesterTier(tokenTier) ? "Token modo testeo" : "Nuevo token"}
                  </CardTitle>
                  <CardDescription>
                    {isTesterTier(tokenTier)
                      ? "Solo para pruebas: acceso al launcher con token + nombre MC (sin cuenta ni contraseña)."
                      : "Free / Premium = acceso completo al hub con token de activación."}
                  </CardDescription>
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <Select
                  compact
                  label="Tipo"
                  value={tokenTier}
                  onChange={(e) => setTokenTier(e.target.value as LauncherTokenTierId)}
                  options={
                    testerModeEnabled
                      ? TOKEN_TIER_OPTIONS.filter((o) => isTesterTier(o.value))
                      : TOKEN_TIER_OPTIONS.filter((o) => !isTesterTier(o.value))
                  }
                />
                {isTesterTier(tokenTier) && testerModeEnabled && (
                  <Input
                    compact
                    label="Nombre en Minecraft"
                    value={testerUsername}
                    onChange={(e) => setTesterUsername(e.target.value)}
                    placeholder="Steve"
                    autoComplete="off"
                    className="min-w-[10rem]"
                  />
                )}
                <Button
                  onClick={() => void handleGenerate()}
                  disabled={
                    generating ||
                    (isTesterTier(tokenTier) && (!testerModeEnabled || !testerUsername.trim()))
                  }
                >
                <KeyRound className="h-3.5 w-3.5" />
                {generating ? "Generando…" : "Generar token"}
              </Button>
              </div>
            </div>
          </CardHeader>
          {oneTime && (
            <CardContent className="border-t border-[var(--color-border-subtle)]">
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
                <p className="text-sm font-medium text-amber-200">
                  {oneTime.label} — copia ahora, no se volverá a mostrar
                </p>
                {oneTime.label.startsWith("Tester:") && (
                  <p className="text-xs text-amber-100/80">
                    En el launcher: «Tengo un token» → pegar → Activar. Sin contraseña. El nombre MC ya
                    está en el token.
                  </p>
                )}
                <textarea
                  readOnly
                  rows={2}
                  className="block w-full resize-none break-all rounded-lg border border-amber-500/20 bg-black/40 px-3 py-2 font-mono text-xs text-amber-100"
                  value={oneTime.token}
                  onFocus={(e) => e.currentTarget.select()}
                />
                {copyTokenHint && <p className="text-xs text-emerald-300">{copyTokenHint}</p>}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void copyTextToClipboard(oneTime.token).then((ok) =>
                        setCopyTokenHint(
                          ok
                            ? "Token copiado al portapapeles."
                            : "Selecciona el texto del token y usa Ctrl+C."
                        )
                      );
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" /> Copiar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setOneTime(null);
                      setCopyTokenHint(null);
                    }}
                  >
                    Ocultar
                  </Button>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </section>

      <section className="grid gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-[var(--color-border)] px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">Activos</p>
          <p className="text-2xl font-semibold">{tokenGroups.active.length}</p>
        </div>
        <div className="rounded-xl border border-amber-500/30 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-amber-300/80">Por expirar</p>
          <p className="text-2xl font-semibold">
            {tokenGroups.expiringSoon.length + sessionGroups.expiringSoon.length}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">Usados</p>
          <p className="text-2xl font-semibold">{tokenGroups.used.length}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">Sesiones</p>
          <p className="text-2xl font-semibold">{sessionGroups.active.length}</p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
          Tokens de activación
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard
            title="Activos"
            description="Listos para usar en el launcher"
            count={tokenGroups.active.length}
            icon={<CheckCircle2 className="h-4 w-4" />}
            tone="success"
            empty="No hay tokens disponibles."
          >
            {tokenGroups.active.map((t) => (
              <TokenRow key={t.id} token={t} onRevoke={(id) => void adminAction({ action: "revoke-token", id })} urgent={expiresWithin(t.expiresAt, TOKEN_EXPIRING_MS)} />
            ))}
          </SectionCard>
          <SectionCard
            title="Por expirar"
            description="Caducan en menos de 48 h"
            count={tokenGroups.expiringSoon.length}
            icon={<AlertTriangle className="h-4 w-4 text-amber-400" />}
            tone="warn"
            empty="Ninguno próximo a expirar."
          >
            {tokenGroups.expiringSoon.map((t) => (
              <TokenRow key={t.id} token={t} onRevoke={(id) => void adminAction({ action: "revoke-token", id })} urgent />
            ))}
          </SectionCard>
          <SectionCard title="Usados" description="Ya canjeados" count={tokenGroups.used.length} icon={<Clock className="h-4 w-4" />} empty="Ninguno usado.">
            {tokenGroups.used.map((t) => (
              <TokenRow key={t.id} token={t} />
            ))}
          </SectionCard>
          <SectionCard title="Expirados y revocados" description="Inactivos" count={tokenGroups.inactive.length} icon={<XCircle className="h-4 w-4" />} tone="muted" empty="Sin inactivos.">
            {tokenGroups.inactive.map((t) => (
              <TokenRow key={t.id} token={t} />
            ))}
          </SectionCard>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
          Sesiones de launcher
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <SectionCard title="Activas" description="Con acceso al hub" count={sessionGroups.active.length} icon={<CheckCircle2 className="h-4 w-4" />} tone="success" empty="Ninguna sesión activa.">
            {sessionGroups.active.map((s) => (
              <SessionRow key={s.id} session={s} onRevoke={(id) => void adminAction({ action: "revoke-session", id })} urgent={expiresWithin(s.expiresAt, SESSION_EXPIRING_MS)} />
            ))}
          </SectionCard>
          <SectionCard title="Por expirar" description="Caducan en menos de 7 días" count={sessionGroups.expiringSoon.length} icon={<AlertTriangle className="h-4 w-4 text-amber-400" />} tone="warn" empty="Ninguna por expirar.">
            {sessionGroups.expiringSoon.map((s) => (
              <SessionRow key={s.id} session={s} onRevoke={(id) => void adminAction({ action: "revoke-session", id })} urgent />
            ))}
          </SectionCard>
          <SectionCard title="Revocadas y expiradas" description="Sin acceso" count={sessionGroups.inactive.length} icon={<XCircle className="h-4 w-4" />} tone="muted" empty="Sin sesiones inactivas.">
            {sessionGroups.inactive.map((s) => (
              <SessionRow key={s.id} session={s} />
            ))}
          </SectionCard>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-[var(--color-accent)]" />
              <CardTitle>Auditoría</CardTitle>
            </div>
            <CardDescription>Últimos eventos de seguridad</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
              {auditLog.map((e) => (
                <li key={e.id} className="rounded-lg border border-[var(--color-border)] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{AUDIT_LABELS[e.action] ?? e.action}</span>
                    <span className="text-[11px] text-[var(--color-muted)]">{formatRelativeTime(e.at)}</span>
                  </div>
                  {(e.ipHint || e.meta) && (
                    <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
                      {[e.ipHint, e.meta].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </li>
              ))}
              {!auditLog.length && <li className="text-[var(--color-muted)]">Sin eventos aún.</li>}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-[var(--color-accent)]" />
              <CardTitle>Modelo de seguridad</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-[var(--color-text-soft)]">
              {SECURITY_FEATURES.map((f) => (
                <li key={f} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500/80" />
                  {f}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function TokenRow({
  token,
  onRevoke,
  urgent,
}: {
  token: ActivationTokenPublic;
  onRevoke?: (id: string) => void;
  urgent?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium">{token.label}</p>
        <p className="text-[11px] text-[var(--color-muted)]">
          Creado {formatDate(token.createdAt)}
          {token.minecraftUsername ? ` · MC: ${token.minecraftUsername}` : ""}
          {token.usedAt ? ` · Usado ${formatRelativeTime(token.usedAt)}` : ` · ${formatExpiresIn(token.expiresAt)}`}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {isTesterTier(token.tier) && (
          <Badge className="bg-violet-500/20 text-violet-200">Tester</Badge>
        )}
        {urgent && <Badge className="bg-amber-500/20 text-amber-300">Por expirar</Badge>}
        {onRevoke && (
          <Button size="sm" variant="ghost" onClick={() => onRevoke(token.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </li>
  );
}

function SessionRow({
  session,
  onRevoke,
  urgent,
}: {
  session: DeviceSessionPublic;
  onRevoke?: (id: string) => void;
  urgent?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium">
          {session.username ?? session.label ?? session.deviceId.slice(0, 14)}
        </p>
        <p className="text-[11px] text-[var(--color-muted)]">
          Visto {formatRelativeTime(session.lastSeenAt)} · {formatExpiresIn(session.expiresAt)}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {isTesterTier(session.tier) && (
          <Badge className="bg-violet-500/20 text-violet-200">Tester</Badge>
        )}
        {urgent && <Badge className="bg-amber-500/20 text-amber-300">Por expirar</Badge>}
        {onRevoke && (
          <Button size="sm" variant="ghost" onClick={() => onRevoke(session.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </li>
  );
}
