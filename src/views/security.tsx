"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { FilterPills } from "@/components/ui/FilterPills";
import { StatCard } from "@/components/ui/StatCard";
import { Avatar } from "@/components/ui/Avatar";
import { severityColors } from "@/lib/feature-data";
import { detectionTypeLabels } from "@/lib/security/catalog";
import { formatRelativeTime } from "@/lib/utils";
import { badgeDefault, rowItem } from "@/lib/styles";
import { AlertTriangle, Ban, CheckCircle, Shield, ShieldAlert } from "lucide-react";
import type { AlertSeverity, SecurityAlert, SecurityRule } from "@/types/features";

const severityFilters = [
  { id: "all", label: "Todas" },
  { id: "critical", label: "Críticas" },
  { id: "high", label: "Altas" },
  { id: "medium", label: "Medias" },
  { id: "low", label: "Bajas" },
];

type ClientHit = {
  name: string;
  detectionType: SecurityAlert["type"];
  severity: AlertSeverity;
  hitCount: number;
  lastSeenAt: string;
};

type Overview = {
  openAlerts: number;
  criticalAlerts: number;
  bansToday: number;
  activeRules: number;
};

export default function SecurityPage() {
  const [tab, setTab] = useState("alerts");
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [rules, setRules] = useState<SecurityRule[]>([]);
  const [clients, setClients] = useState<ClientHit[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [severityFilter, setSeverityFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "admin" | "launcher">("all");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/security", { credentials: "include", cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        alerts?: SecurityAlert[];
        rules?: SecurityRule[];
        clients?: ClientHit[];
        overview?: Overview;
      };
      setAlerts(data.alerts ?? []);
      setRules(data.rules ?? []);
      setClients(data.clients ?? []);
      setOverview(data.overview ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const timer = setInterval(() => void refresh(), 8_000);
    return () => clearInterval(timer);
  }, [refresh]);

  const unresolved = alerts.filter((a) => !a.resolved);
  const critical = overview?.criticalAlerts ?? unresolved.filter((a) => a.severity === "critical").length;

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (severityFilter !== "all" && a.severity !== severityFilter) return false;
      if (sourceFilter !== "all" && a.source !== sourceFilter) return false;
      return true;
    });
  }, [alerts, severityFilter, sourceFilter]);

  const resolveAlert = async (id: string) => {
    const res = await fetch("/api/security", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve", alertId: id }),
    });
    if (res.ok) void refresh();
  };

  const toggleRule = async (ruleId: string, enabled: boolean) => {
    const res = await fetch("/api/security", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_rule", ruleId, enabled }),
    });
    if (res.ok) void refresh();
  };

  const exportLog = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), alerts, rules }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `security-log-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Header
        title="Seguridad"
        description="30 detecciones en vivo — admin panel y launcher"
        actions={
          <Button size="sm" variant="outline" onClick={exportLog}>
            <Shield className="h-3.5 w-3.5" strokeWidth={1.5} /> Exportar log
          </Button>
        }
      />

      <PageContent>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            title="Alertas abiertas"
            value={loading ? "…" : (overview?.openAlerts ?? unresolved.length)}
            icon={ShieldAlert}
            trend={critical > 0 ? "down" : "neutral"}
            change={critical > 0 ? `${critical} críticas` : undefined}
          />
          <StatCard title="Bans hoy" value={loading ? "…" : (overview?.bansToday ?? 0)} icon={Ban} />
          <StatCard
            title="Reglas activas"
            value={loading ? "…" : (overview?.activeRules ?? rules.filter((r) => r.enabled).length)}
            icon={Shield}
          />
        </div>

        <Tabs
          tabs={[
            { id: "alerts", label: `Alertas (${unresolved.length})` },
            { id: "rules", label: `Reglas (${rules.length})` },
            { id: "clients", label: "Clientes detectados" },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === "alerts" && (
          <>
            <div className="flex flex-wrap gap-2">
              <FilterPills options={severityFilters} active={severityFilter} onChange={setSeverityFilter} />
              <FilterPills
                options={[
                  { id: "all", label: "Todas las fuentes" },
                  { id: "admin", label: "Admin panel" },
                  { id: "launcher", label: "Launcher" },
                ]}
                active={sourceFilter}
                onChange={(id) => setSourceFilter(id as typeof sourceFilter)}
              />
            </div>
            <div className="space-y-2">
              {filteredAlerts.map((alert) => (
                <div key={alert.id} className={`${rowItem} ${alert.resolved ? "opacity-60" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 gap-3">
                      <Avatar name={alert.username} size="sm" />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm text-[var(--color-text)]">{alert.username}</p>
                          <Badge className={severityColors[alert.severity]}>{alert.severity}</Badge>
                          <Badge className={badgeDefault}>{detectionTypeLabels[alert.type]}</Badge>
                          <Badge className={badgeDefault}>{alert.source}</Badge>
                          {!alert.resolved && (
                            <span className="text-[10px] text-[var(--color-accent)]">● en vivo</span>
                          )}
                          {alert.resolved && (
                            <Badge className={badgeDefault}>
                              <CheckCircle className="mr-1 h-3 w-3" /> Resuelta
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-[var(--color-text-soft)]">{alert.detail}</p>
                        <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                          {formatRelativeTime(alert.detectedAt)}
                          {alert.ip ? ` · IP ${alert.ip}` : ""}
                          {alert.deviceId ? ` · ${alert.deviceId.slice(0, 10)}…` : ""}
                        </p>
                      </div>
                    </div>
                    {!alert.resolved && (
                      <div className="flex shrink-0 gap-2">
                        <Button size="sm" variant="outline" onClick={() => void resolveAlert(alert.id)}>
                          Marcar resuelta
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {!loading && filteredAlerts.length === 0 && (
                <p className={rowItem}>Sin alertas con estos filtros.</p>
              )}
            </div>
          </>
        )}

        {tab === "rules" && (
          <div className="space-y-2">
            {rules.map((rule) => (
              <div key={rule.id} className={`flex items-start justify-between gap-4 ${rowItem}`}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm text-[var(--color-text)]">{rule.name}</p>
                    <Badge className={badgeDefault}>{rule.source}</Badge>
                    <Badge className={badgeDefault}>→ {rule.action}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-soft)]">{rule.description}</p>
                </div>
                <Toggle
                  compact
                  checked={rule.enabled}
                  onChange={(checked) => void toggleRule(rule.id, checked)}
                />
              </div>
            ))}
          </div>
        )}

        {tab === "clients" && (
          <Card>
            <CardHeader>
              <CardTitle>Clientes, mods y amenazas recurrentes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {clients.map((client) => (
                <div key={client.name} className={`flex items-center justify-between ${rowItem}`}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-[var(--color-muted)]" strokeWidth={1.5} />
                    <span className="text-sm text-[var(--color-text)]">{client.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--color-muted)]">{client.hitCount} detecciones</span>
                    <Badge className={severityColors[client.severity]}>{client.severity}</Badge>
                  </div>
                </div>
              ))}
              {!loading && clients.length === 0 && (
                <p className="text-sm text-[var(--color-muted)]">Aún no hay clientes o mods detectados.</p>
              )}
            </CardContent>
          </Card>
        )}
      </PageContent>
    </>
  );
}
