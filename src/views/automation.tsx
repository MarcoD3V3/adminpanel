"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { formatRelativeTime } from "@/lib/utils";
import { badgeDefault, rowItem } from "@/lib/styles";
import {
  Bot,
  CheckCircle,
  Clock,
  Play,
  Plus,
  Trash2,
  Webhook,
  XCircle,
  Zap,
} from "lucide-react";
import type { Integration, ScheduledEvent } from "@/types/features";
import type { AutomationRuleRecord, ModerationSettings } from "@/lib/automation/types";

type TriggerDef = { id: string; label: string; description: string; configFields?: string[] };
type ActionDef = { id: string; label: string; description: string; configFields?: string[] };
type RunRecord = {
  id: string;
  ruleId: string;
  ruleName: string;
  triggerEvent: string;
  success: boolean;
  detail: string;
  createdAt: string;
};
type Overview = { activeRules: number; runsToday: number; pendingJobs: number; tempBans: number };

type RuleView = AutomationRuleRecord & { triggerLabel: string; actionLabel: string };

const emptyRuleForm = () => ({
  name: "",
  triggerType: "security.alert",
  actionType: "notify_admin",
  triggerConfigJson: "{}",
  actionConfigJson: "{}",
  enabled: true,
});

const scheduleActions = [
  { value: "maintenance", label: "Mantenimiento" },
  { value: "notification", label: "Notificación" },
  { value: "force_update", label: "Forzar update" },
  { value: "broadcast", label: "Broadcast" },
];

export default function AutomationPage() {
  const [tab, setTab] = useState("rules");
  const [rules, setRules] = useState<RuleView[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [jobs, setJobs] = useState<ScheduledEvent[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [moderation, setModeration] = useState<ModerationSettings | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [triggers, setTriggers] = useState<TriggerDef[]>([]);
  const [actions, setActions] = useState<ActionDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleForm, setRuleForm] = useState(emptyRuleForm);
  const [saving, setSaving] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    name: "",
    action: "notification",
    date: "",
    time: "12:00",
    target: "all",
    payload: '{"message": ""}',
  });
  const [blacklistText, setBlacklistText] = useState("");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/automation", { credentials: "include", cache: "no-store" });
      const data = (await res.json()) as {
        rules?: Array<AutomationRuleRecord & { triggerLabel?: string; actionLabel?: string }>;
        runs?: RunRecord[];
        jobs?: ScheduledEvent[];
        integrations?: Integration[];
        moderation?: ModerationSettings;
        overview?: Overview;
        triggers?: TriggerDef[];
        actions?: ActionDef[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Error al cargar automatización");
        return;
      }

      const mapped = (data.rules ?? []).map((r) => ({
        ...r,
        triggerLabel: r.triggerLabel ?? formatTrigger(r),
        actionLabel: r.actionLabel ?? formatAction(r),
      }));
      setRules(mapped);
      setRuns(data.runs ?? []);
      setJobs(data.jobs ?? []);
      setIntegrations(data.integrations ?? []);
      setModeration(data.moderation ?? null);
      setOverview(data.overview ?? null);
      setTriggers(data.triggers ?? []);
      setActions(data.actions ?? []);
      if (data.moderation) {
        setBlacklistText(data.moderation.blacklist.join("\n"));
      }
      setError(null);
    } catch {
      setError("Error de red");
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

  const triggerOptions = useMemo(
    () => triggers.map((t) => ({ value: t.id, label: t.label })),
    [triggers]
  );
  const actionOptions = useMemo(
    () => actions.map((a) => ({ value: a.id, label: a.label })),
    [actions]
  );

  async function toggleRule(id: string, enabled: boolean) {
    await fetch("/api/automation", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled }),
    });
    void refresh();
  }

  async function deleteRule(id: string) {
    await fetch(`/api/automation?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    void refresh();
  }

  async function testRule(id: string) {
    await fetch("/api/automation", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "test", ruleId: id }),
    });
    void refresh();
  }

  async function createRule() {
    setSaving(true);
    try {
      let triggerConfig = {};
      let actionConfig = {};
      try {
        triggerConfig = JSON.parse(ruleForm.triggerConfigJson || "{}") as Record<string, unknown>;
        actionConfig = JSON.parse(ruleForm.actionConfigJson || "{}") as Record<string, unknown>;
      } catch {
        setError("JSON de configuración inválido");
        return;
      }
      const res = await fetch("/api/automation", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: ruleForm.name,
          triggerType: ruleForm.triggerType,
          actionType: ruleForm.actionType,
          triggerConfig,
          actionConfig,
          enabled: ruleForm.enabled,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "No se pudo crear la regla");
        return;
      }
      setShowRuleForm(false);
      setRuleForm(emptyRuleForm());
      void refresh();
    } finally {
      setSaving(false);
    }
  }

  async function saveModeration() {
    if (!moderation) return;
    setSaving(true);
    try {
      const blacklist = blacklistText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      await fetch("/api/automation", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "moderation",
          settings: { ...moderation, blacklist },
        }),
      });
      void refresh();
    } finally {
      setSaving(false);
    }
  }

  async function scheduleAction() {
    if (!scheduleForm.date || !scheduleForm.time) return;
    setSaving(true);
    try {
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(scheduleForm.payload || "{}") as Record<string, unknown>;
      } catch {
        setError("Payload JSON inválido");
        return;
      }
      const scheduledAt = new Date(`${scheduleForm.date}T${scheduleForm.time}:00Z`).toISOString();
      await fetch("/api/automation", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "schedule",
          name: scheduleForm.name || "Tarea programada",
          action: scheduleForm.action,
          scheduledAt,
          target: scheduleForm.target,
          payload,
        }),
      });
      void refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Header
        title="Automatización"
        description="Reglas, programador y webhooks"
        actions={
          <Button size="sm" variant="outline" onClick={() => setShowRuleForm((v) => !v)}>
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> Regla
          </Button>
        }
      />

      <PageContent>
        {overview && (
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Reglas activas" value={overview.activeRules} icon={Zap} />
            <StatCard title="Ejecuciones hoy" value={overview.runsToday} icon={Bot} />
            <StatCard title="Jobs pendientes" value={overview.pendingJobs} icon={Clock} />
            <StatCard title="Bans temporales" value={overview.tempBans} icon={XCircle} />
          </div>
        )}

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        <Tabs
          tabs={[
            { id: "rules", label: "Reglas" },
            { id: "scheduler", label: "Programador" },
            { id: "webhooks", label: "Webhooks" },
            { id: "moderation", label: "Moderación" },
            { id: "history", label: "Historial" },
          ]}
          active={tab}
          onChange={setTab}
        />

        {showRuleForm && tab === "rules" && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Nueva regla</CardTitle>
              <CardDescription>Si [trigger] → entonces [acción]</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Nombre"
                value={ruleForm.name}
                onChange={(e) => setRuleForm((f) => ({ ...f, name: e.target.value }))}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="Trigger"
                  value={ruleForm.triggerType}
                  options={triggerOptions}
                  onChange={(e) => setRuleForm((f) => ({ ...f, triggerType: e.target.value }))}
                />
                <Select
                  label="Acción"
                  value={ruleForm.actionType}
                  options={actionOptions}
                  onChange={(e) => setRuleForm((f) => ({ ...f, actionType: e.target.value }))}
                />
              </div>
              <Textarea
                label="Config trigger (JSON)"
                rows={2}
                value={ruleForm.triggerConfigJson}
                onChange={(e) => setRuleForm((f) => ({ ...f, triggerConfigJson: e.target.value }))}
              />
              <Textarea
                label="Config acción (JSON)"
                rows={2}
                value={ruleForm.actionConfigJson}
                onChange={(e) => setRuleForm((f) => ({ ...f, actionConfigJson: e.target.value }))}
              />
              <div className="flex gap-2">
                <Button onClick={() => void createRule()} disabled={saving || !ruleForm.name}>
                  Crear regla
                </Button>
                <Button variant="outline" onClick={() => setShowRuleForm(false)}>
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {tab === "rules" && (
          <div className="space-y-2">
            {loading && rules.length === 0 && (
              <p className="text-sm text-[var(--color-muted)]">Cargando reglas…</p>
            )}
            {rules.map((rule) => (
              <div key={rule.id} className={`flex items-center justify-between gap-4 ${rowItem}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[var(--color-text)]">{rule.name}</p>
                  <p className="text-xs text-[var(--color-text-soft)]">
                    Si <span className="text-[var(--color-accent)]">{rule.triggerLabel}</span> → {rule.actionLabel}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-muted)]">
                    {rule.lastRun && <span>{formatRelativeTime(rule.lastRun)}</span>}
                    <span>· {rule.runCount} ejecuciones</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => void testRule(rule.id)} title="Probar">
                    <Play className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void deleteRule(rule.id)} title="Eliminar">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <Toggle compact checked={rule.enabled} onChange={(checked) => void toggleRule(rule.id, checked)} />
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "scheduler" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Programar acción</CardTitle>
                <CardDescription>Fecha y hora exacta (UTC)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Nombre"
                  value={scheduleForm.name}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, name: e.target.value }))}
                />
                <Select
                  label="Acción"
                  value={scheduleForm.action}
                  options={scheduleActions}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, action: e.target.value }))}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Fecha"
                    type="date"
                    value={scheduleForm.date}
                    onChange={(e) => setScheduleForm((f) => ({ ...f, date: e.target.value }))}
                  />
                  <Input
                    label="Hora (UTC)"
                    type="time"
                    value={scheduleForm.time}
                    onChange={(e) => setScheduleForm((f) => ({ ...f, time: e.target.value }))}
                  />
                </div>
                <Select
                  label="Destino"
                  value={scheduleForm.target}
                  options={[
                    { value: "all", label: "Todos" },
                    { value: "online", label: "Online" },
                    { value: "premium", label: "Premium" },
                  ]}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, target: e.target.value }))}
                />
                <Textarea
                  label="Payload"
                  rows={3}
                  value={scheduleForm.payload}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, payload: e.target.value }))}
                />
                <Button onClick={() => void scheduleAction()} disabled={saving}>
                  Programar
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Cola programada</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {jobs.length === 0 && (
                  <p className="text-sm text-[var(--color-muted)]">Sin tareas pendientes</p>
                )}
                {jobs.map((job) => (
                  <div key={job.id} className={rowItem}>
                    <p className="text-sm">{job.name}</p>
                    <p className="text-xs text-[var(--color-text-soft)]">
                      {job.action} · {new Date(job.scheduledAt).toLocaleString()} ·{" "}
                      <Badge className={badgeDefault}>{job.status}</Badge>
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "webhooks" && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--color-text-soft)]">
              Los webhooks se gestionan en{" "}
              <a href="/integrations" className="text-[var(--color-accent)] underline">
                Integraciones
              </a>
              . Aquí ves el estado conectado a automatización.
            </p>
            {integrations.map((wh) => (
              <div key={wh.id} className={`flex items-center justify-between gap-4 ${rowItem}`}>
                <div className="flex min-w-0 items-start gap-3">
                  <Webhook className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-muted)]" strokeWidth={1.5} />
                  <div className="min-w-0">
                    <p className="text-sm text-[var(--color-text)]">{wh.name}</p>
                    <p className="truncate font-mono text-xs text-[var(--color-text-soft)]">{wh.url}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {wh.events.map((ev) => (
                        <Badge key={ev} className={badgeDefault}>
                          {ev}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <Badge className={wh.active ? "bg-emerald-500/20 text-emerald-300" : badgeDefault}>
                  {wh.active ? "Activo" : "Off"}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {tab === "moderation" && moderation && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Filtros</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Toggle
                  label="Palabras prohibidas"
                  checked={moderation.wordFilter}
                  onChange={(v) => setModeration((m) => (m ? { ...m, wordFilter: v } : m))}
                />
                <Toggle
                  label="Anti-spam"
                  checked={moderation.spamDetect}
                  onChange={(v) => setModeration((m) => (m ? { ...m, spamDetect: v } : m))}
                />
                <Toggle
                  label="Bloquear links"
                  checked={moderation.blockLinks}
                  onChange={(v) => setModeration((m) => (m ? { ...m, blockLinks: v } : m))}
                />
                <Toggle
                  label="Slow mode"
                  checked={moderation.slowMode}
                  onChange={(v) => setModeration((m) => (m ? { ...m, slowMode: v } : m))}
                />
                <Textarea
                  label="Lista negra"
                  rows={4}
                  placeholder="Una por línea..."
                  value={blacklistText}
                  onChange={(e) => setBlacklistText(e.target.value)}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Acciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  label="Tras 3 flagged"
                  value={moderation.flaggedAction}
                  options={[
                    { value: "mute_1h", label: "Silenciar 1h" },
                    { value: "mute_24h", label: "Silenciar 24h" },
                    { value: "ban", label: "Ban" },
                    { value: "review", label: "Revisión manual" },
                  ]}
                  onChange={(e) =>
                    setModeration((m) =>
                      m ? { ...m, flaggedAction: e.target.value as ModerationSettings["flaggedAction"] } : m
                    )
                  }
                />
                <Select
                  label="Tras reporte"
                  value={moderation.reportAction}
                  options={[
                    { value: "notify", label: "Notificar admin" },
                    { value: "hide", label: "Ocultar mensaje" },
                    { value: "ban", label: "Ban inmediato" },
                  ]}
                  onChange={(e) =>
                    setModeration((m) =>
                      m ? { ...m, reportAction: e.target.value as ModerationSettings["reportAction"] } : m
                    )
                  }
                />
                <Button onClick={() => void saveModeration()} disabled={saving}>
                  Guardar
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "history" && (
          <div className="space-y-2">
            {runs.map((run) => (
              <div key={run.id} className={`flex items-start gap-3 ${rowItem}`}>
                {run.success ? (
                  <CheckCircle className="mt-0.5 h-4 w-4 text-emerald-400" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 text-red-400" />
                )}
                <div className="min-w-0">
                  <p className="text-sm text-[var(--color-text)]">{run.ruleName}</p>
                  <p className="text-xs text-[var(--color-text-soft)]">
                    {run.triggerEvent} · {run.detail}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--color-muted)]">{formatRelativeTime(run.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </PageContent>
    </>
  );
}

function formatTrigger(rule: AutomationRuleRecord): string {
  if (rule.triggerType === "chat.flags_threshold") {
    return `${rule.triggerConfig.count ?? 3} flags / ${rule.triggerConfig.windowMinutes ?? 5}min`;
  }
  if (rule.triggerType === "launcher.version_below") {
    return `Launcher < v${rule.triggerConfig.minVersion ?? "?"}`;
  }
  if (rule.triggerType === "cron") {
    return `Cron ${rule.triggerConfig.hour ?? 0}:${String(rule.triggerConfig.minute ?? 0).padStart(2, "0")} UTC`;
  }
  return rule.triggerType;
}

function formatAction(rule: AutomationRuleRecord): string {
  if (rule.actionType === "ban_user_temp") return `Ban ${rule.actionConfig.hours ?? 24}h`;
  if (rule.actionType === "grant_points") return `+${rule.actionConfig.points ?? 0} pts`;
  return rule.actionType;
}
