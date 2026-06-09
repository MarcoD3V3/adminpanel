"use client";

import { useMemo, useState } from "react";
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
import {
  mockSecurityAlerts,
  mockSecurityRules,
  severityColors,
} from "@/lib/feature-data";
import { formatRelativeTime } from "@/lib/utils";
import { badgeDefault, rowItem } from "@/lib/styles";
import { AlertTriangle, Ban, CheckCircle, Shield, ShieldAlert } from "lucide-react";
import type { AlertSeverity } from "@/types/features";

const severityFilters = [
  { id: "all", label: "Todas" },
  { id: "critical", label: "Críticas" },
  { id: "high", label: "Altas" },
  { id: "medium", label: "Medias" },
  { id: "low", label: "Bajas" },
];

const alertTypeLabels: Record<string, string> = {
  cheat_client: "Cliente hackeado",
  modified_jar: "JAR modificado",
  hwid_mismatch: "HWID sospechoso",
  suspicious_mod: "Mod no permitido",
  injection: "Inyección detectada",
};

export default function SecurityPage() {
  const [tab, setTab] = useState("alerts");
  const [alerts, setAlerts] = useState(mockSecurityAlerts);
  const [rules, setRules] = useState(mockSecurityRules);
  const [severityFilter, setSeverityFilter] = useState("all");

  const unresolved = alerts.filter((a) => !a.resolved);
  const critical = unresolved.filter((a) => a.severity === "critical").length;

  const filteredAlerts = useMemo(
    () =>
      severityFilter === "all"
        ? alerts
        : alerts.filter((a) => a.severity === severityFilter),
    [alerts, severityFilter]
  );

  const resolveAlert = (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, resolved: true } : a)));
  };

  const banUser = (username: string) => {
    alert(`Ban aplicado a ${username}`);
    setAlerts((prev) => prev.map((a) => (a.username === username ? { ...a, resolved: true } : a)));
  };

  return (
    <>
      <Header
        title="Seguridad"
        description="Anti-cheat, integridad de cliente y alertas"
        actions={
          <Button size="sm" variant="outline">
            <Shield className="h-3.5 w-3.5" strokeWidth={1.5} /> Exportar log
          </Button>
        }
      />

      <PageContent>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard title="Alertas abiertas" value={unresolved.length} icon={ShieldAlert} trend={critical > 0 ? "down" : "neutral"} change={critical > 0 ? `${critical} críticas` : undefined} />
          <StatCard title="Bans hoy" value={3} icon={Ban} />
          <StatCard title="Reglas activas" value={rules.filter((r) => r.enabled).length} icon={Shield} />
        </div>

        <Tabs
          tabs={[
            { id: "alerts", label: "Alertas" },
            { id: "rules", label: "Reglas" },
            { id: "clients", label: "Clientes detectados" },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === "alerts" && (
          <>
            <FilterPills options={severityFilters} active={severityFilter} onChange={setSeverityFilter} />
            <div className="space-y-2">
              {filteredAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`${rowItem} ${alert.resolved ? "opacity-60" : ""}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 gap-3">
                      <Avatar name={alert.username} size="sm" />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm text-[var(--color-text)]">{alert.username}</p>
                          <Badge className={severityColors[alert.severity]}>{alert.severity}</Badge>
                          <Badge className={badgeDefault}>{alertTypeLabels[alert.type]}</Badge>
                          {alert.resolved && (
                            <Badge className={badgeDefault}><CheckCircle className="mr-1 h-3 w-3" /> Resuelta</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-[var(--color-text-soft)]">{alert.detail}</p>
                        <p className="mt-1 text-[11px] text-[var(--color-muted)]">{formatRelativeTime(alert.detectedAt)}</p>
                      </div>
                    </div>
                    {!alert.resolved && (
                      <div className="flex shrink-0 gap-2">
                        <Button size="sm" variant="outline" onClick={() => resolveAlert(alert.id)}>Marcar resuelta</Button>
                        <Button size="sm" onClick={() => banUser(alert.username)}>Banear</Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
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
                    <Badge className={badgeDefault}>→ {rule.action}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-soft)]">{rule.description}</p>
                </div>
                <Toggle
                  compact
                  checked={rule.enabled}
                  onChange={(checked) =>
                    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled: checked } : r)))
                  }
                />
              </div>
            ))}
          </div>
        )}

        {tab === "clients" && (
          <Card>
            <CardHeader>
              <CardTitle>Clientes y mods detectados recientemente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { name: "Wurst Client", count: 12, severity: "critical" as AlertSeverity },
                { name: "Impact Client", count: 5, severity: "critical" as AlertSeverity },
                { name: "xray-1.0.jar", count: 23, severity: "low" as AlertSeverity },
                { name: "LiquidBounce", count: 3, severity: "high" as AlertSeverity },
                { name: "Modified minecraft.jar", count: 8, severity: "high" as AlertSeverity },
              ].map((client) => (
                <div key={client.name} className={`flex items-center justify-between ${rowItem}`}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-[var(--color-muted)]" strokeWidth={1.5} />
                    <span className="text-sm text-[var(--color-text)]">{client.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--color-muted)]">{client.count} detecciones</span>
                    <Badge className={severityColors[client.severity]}>{client.severity}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </PageContent>
    </>
  );
}
