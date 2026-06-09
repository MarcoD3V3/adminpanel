"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { FilterPills } from "@/components/ui/FilterPills";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { LiveOpsMap } from "@/components/live-ops/LiveOpsMap";
import { statusColors } from "@/lib/mock-data";
import { formatRelativeTime, cn } from "@/lib/utils";
import { useAdminPageActive } from "@/lib/use-admin-page-active";
import { rowItem, badgeDefault, badgeDanger, badgeWarning } from "@/lib/styles";
import type { LiveOpsSession } from "@/types";
import {
  Radio,
  RefreshCw,
  MessageSquare,
  Ban,
  Power,
  X,
  Crown,
  AlertTriangle,
  Shield,
} from "lucide-react";

const filters = [
  { id: "all", label: "Todos" },
  { id: "playing", label: "Jugando" },
  { id: "online", label: "Online" },
  { id: "alerts", label: "Alertas" },
];

const healthLabel = {
  healthy: "Estable",
  warning: "Atención",
  critical: "Crítico",
};

const healthBadge = {
  healthy: "bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-[var(--color-border-subtle)]",
  warning: badgeWarning,
  critical: badgeDanger,
};

const REFRESH_MS = 4_000;

async function liveOpsAction(sessionId: string, action: string, payload?: { message?: string }) {
  const res = await fetch("/api/live-ops", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, sessionId, payload }),
  });
  return res.json() as Promise<{ success?: boolean; message?: string; error?: string }>;
}

export default function LiveOpsPage() {
  const isActivePage = useAdminPageActive("/live-ops");
  const [sessions, setSessions] = useState<LiveOpsSession[]>([]);
  const [authenticated, setAuthenticated] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/live-ops", { credentials: "include" });
      const data = (await res.json()) as {
        authenticated?: boolean;
        sessions?: LiveOpsSession[];
        error?: string;
      };
      setAuthenticated(Boolean(data.authenticated));
      const list = data.sessions ?? [];
      setSessions(list);
      if (!data.authenticated) {
        setError("Inicia sesión en Acceso Launcher para ver sesiones en vivo.");
      }
      setSelectedId((prev) => {
        if (prev && list.some((s) => s.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch {
      setError("Error de red al cargar Live Ops");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isActivePage || !live) return;
    const interval = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(interval);
  }, [isActivePage, live, refresh]);

  const filtered = useMemo(() => {
    switch (filter) {
      case "playing":
        return sessions.filter((s) => s.status === "playing");
      case "online":
        return sessions.filter((s) => s.status === "online" || s.status === "idle");
      case "alerts":
        return sessions.filter((s) => s.health !== "healthy");
      default:
        return sessions;
    }
  }, [sessions, filter]);

  const selected = sessions.find((s) => s.id === selectedId) ?? null;

  const stats = useMemo(
    () => ({
      total: sessions.length,
      playing: sessions.filter((s) => s.status === "playing").length,
      countries: new Set(sessions.map((s) => s.countryCode)).size,
      alerts: sessions.filter((s) => s.health !== "healthy").length,
    }),
    [sessions]
  );

  const runAction = useCallback(
    async (action: string, session: LiveOpsSession) => {
      setActionMsg(null);
      setError(null);

      if (action === "message") {
        const msg = window.prompt(`Mensaje para ${session.username}:`);
        if (!msg?.trim()) return;
        const data = await liveOpsAction(session.id, "message", { message: msg.trim() });
        if (!data.success) setError(data.error ?? "No se pudo enviar el mensaje");
        else setActionMsg(data.message ?? "Mensaje enviado");
        return;
      }

      if (action === "ban") {
        if (!confirm(`¿Banear a ${session.username}? Revocará su cuenta y sesiones.`)) return;
        const data = await liveOpsAction(session.id, "ban");
        if (!data.success) setError(data.error ?? "No se pudo banear");
        else {
          setActionMsg(data.message ?? "Usuario baneado");
          await refresh();
        }
        return;
      }

      const data = await liveOpsAction(session.id, action);
      if (!data.success) setError(data.error ?? `No se pudo ejecutar ${action}`);
      else setActionMsg(data.message ?? `Acción ${action} encolada`);
    },
    [refresh]
  );

  if (!authenticated) {
    return (
      <>
        <Header title="Live Ops" description="Centro de mando en vivo — sesiones activas del launcher" />
        <PageContent>
          <Card className="border-amber-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-amber-400" />
                Acceso restringido
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--color-muted)]">
              Ve a <strong>Control → Acceso Launcher</strong>, inicia sesión como admin y vuelve aquí.
            </CardContent>
          </Card>
        </PageContent>
      </>
    );
  }

  return (
    <>
      <Header
        title="Live Ops"
        description="Centro de mando en vivo — sesiones activas del launcher"
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={live ? "primary" : "outline"}
              onClick={() => setLive((v) => !v)}
            >
              <Radio className="h-3.5 w-3.5" strokeWidth={1.5} />
              {live ? "En vivo" : "Pausado"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} strokeWidth={1.5} />
            </Button>
          </div>
        }
      />

      <PageContent>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {actionMsg && <p className="text-sm text-emerald-300">{actionMsg}</p>}

        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: "Sesiones activas", value: stats.total },
            { label: "Jugando MC", value: stats.playing },
            { label: "Países", value: stats.countries },
            { label: "Alertas", value: stats.alerts },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-5">
                <p className="text-2xl font-light text-[var(--color-text)]">{s.value}</p>
                <p className="text-xs text-[var(--color-muted)]">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {sessions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-[var(--color-muted)]">
              No hay sesiones en vivo. Abre el launcher, inicia sesión y espera unos segundos.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 xl:grid-cols-3">
            <div className="space-y-4 xl:col-span-2">
              <LiveOpsMap sessions={filtered} selectedId={selectedId} onSelect={setSelectedId} />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <FilterPills options={filters} active={filter} onChange={setFilter} />
                <p className="text-xs text-[var(--color-muted)]">
                  {filtered.length} sesiones · actualización cada 4s
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {selected ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <Avatar name={selected.username} />
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {selected.username}
                            {selected.premium && (
                              <Crown className="h-3.5 w-3.5 text-[var(--color-accent)]" strokeWidth={1.5} />
                            )}
                          </CardTitle>
                          <p className="text-xs text-[var(--color-muted)]">
                            {selected.city}, {selected.country}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedId(null)}
                        className="text-[var(--color-muted)] hover:text-[var(--color-text-soft)]"
                        aria-label="Cerrar panel"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        className={
                          statusColors[
                            selected.status === "idle"
                              ? "online"
                              : selected.status === "playing"
                                ? "playing"
                                : selected.status
                          ]
                        }
                      >
                        {selected.status}
                      </Badge>
                      <Badge className={healthBadge[selected.health]}>
                        {healthLabel[selected.health]}
                      </Badge>
                      {selected.minecraftVersion && (
                        <Badge className={badgeDefault}>MC {selected.minecraftVersion}</Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className={rowItem}>
                        <p className="text-[11px] text-[var(--color-muted)]">Launcher</p>
                        <p className="mt-1 text-[var(--color-text)]">v{selected.launcherVersion}</p>
                      </div>
                      <div className={rowItem}>
                        <p className="text-[11px] text-[var(--color-muted)]">Sistema</p>
                        <p className="mt-1 text-[var(--color-text)]">{selected.os}</p>
                      </div>
                      <div className={rowItem}>
                        <p className="text-[11px] text-[var(--color-muted)]">RAM {selected.ramUsage}%</p>
                        <ProgressBar value={selected.ramUsage} className="mt-2" />
                      </div>
                      <div className={rowItem}>
                        <p className="text-[11px] text-[var(--color-muted)]">CPU {selected.cpuUsage}%</p>
                        <ProgressBar value={selected.cpuUsage} className="mt-2" />
                      </div>
                    </div>

                    <p className="text-xs text-[var(--color-muted)]">
                      {selected.ip} · conectado {formatRelativeTime(selected.connectedAt)}
                    </p>

                    {selected.health !== "healthy" && (
                      <div className="flex items-start gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-danger-bg)] px-3 py-2 text-xs text-[var(--color-danger-text)]">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                        {selected.health === "critical"
                          ? "Uso de recursos crítico. Revisar o reiniciar."
                          : "Recursos elevados. Monitorizar sesión."}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" variant="outline" onClick={() => void runAction("restart", selected)}>
                        <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} /> Reiniciar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void runAction("kill_game", selected)}>
                        <Power className="h-3.5 w-3.5" strokeWidth={1.5} /> Cerrar MC
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void runAction("message", selected)}>
                        <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.5} /> Mensaje
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => void runAction("ban", selected)}>
                        <Ban className="h-3.5 w-3.5" strokeWidth={1.5} /> Banear
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center text-sm text-[var(--color-muted)]">
                    Selecciona un punto en el mapa o en la lista
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Sesiones</CardTitle>
                </CardHeader>
                <CardContent className="max-h-64 space-y-1.5 overflow-y-auto">
                  {filtered.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => setSelectedId(session.id)}
                      className={cn(
                        `flex w-full items-center justify-between gap-2 text-left ${rowItem} py-2.5`,
                        selectedId === session.id &&
                          "border-[var(--color-accent-muted)] bg-[var(--color-accent-soft)]"
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 shrink-0 rounded-full",
                            session.health === "critical"
                              ? "bg-[var(--color-danger-text)]"
                              : "bg-[var(--color-accent)]"
                          )}
                        />
                        <span className="truncate text-sm text-[var(--color-text)]">{session.username}</span>
                      </div>
                      <span className="shrink-0 text-[10px] text-[var(--color-muted)]">
                        {session.countryCode}
                      </span>
                    </button>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </PageContent>
    </>
  );
}
