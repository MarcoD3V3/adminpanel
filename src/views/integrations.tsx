"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { Tabs } from "@/components/ui/Tabs";
import { StatCard } from "@/components/ui/StatCard";
import { formatRelativeTime } from "@/lib/utils";
import { badgeDefault, rowItem } from "@/lib/styles";
import { previewDiscordEmbed } from "@/lib/integrations/providers";
import { buildEventPayload } from "@/lib/integrations/events";
import {
  CheckCircle,
  Clock,
  Link2,
  MessageSquare,
  Plus,
  Send,
  Trash2,
  Webhook,
  XCircle,
  Zap,
} from "lucide-react";
import type { Integration, IntegrationDelivery, IntegrationEventType } from "@/types/features";

const typeIcons: Record<string, typeof Webhook> = {
  discord: MessageSquare,
  telegram: Send,
  slack: Link2,
  custom: Webhook,
};

type EventDef = {
  id: IntegrationEventType;
  label: string;
  description: string;
  category: string;
  severity: string;
};

type Overview = {
  activeCount: number;
  eventsToday: number;
  avgSuccessRate: number;
  successTrend: number;
};

const emptyForm = () => ({
  name: "",
  type: "discord",
  url: "",
  description: "",
  events: [] as string[],
  telegramChatId: "",
  discordUsername: "CraftLauncher",
  secretHeaderName: "",
  secretHeaderValue: "",
  retryOnFail: false,
});

export default function IntegrationsPage() {
  const [tab, setTab] = useState("integrations");
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [deliveries, setDeliveries] = useState<IntegrationDelivery[]>([]);
  const [events, setEvents] = useState<EventDef[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations", { credentials: "include", cache: "no-store" });
      const data = (await res.json()) as {
        integrations?: Integration[];
        deliveries?: IntegrationDelivery[];
        events?: EventDef[];
        overview?: Overview;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Error al cargar integraciones");
        return;
      }
      setIntegrations(data.integrations ?? []);
      setDeliveries(data.deliveries ?? []);
      setEvents(data.events ?? []);
      setOverview(data.overview ?? null);
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
    const timer = setInterval(() => void refresh(), 10_000);
    return () => clearInterval(timer);
  }, [refresh]);

  const eventOptions = useMemo(() => events.map((e) => e.id), [events]);

  const eventsByCategory = useMemo(() => {
    const map = new Map<string, EventDef[]>();
    for (const ev of events) {
      const list = map.get(ev.category) ?? [];
      list.push(ev);
      map.set(ev.category, list);
    }
    return map;
  }, [events]);

  const discordPreview = useMemo(() => {
    const lastSecurity = deliveries.find((d) => d.event.startsWith("security."));
    if (lastSecurity) {
      try {
        const payload = JSON.parse(lastSecurity.payloadPreview) as {
          event?: string;
          title?: string;
          message?: string;
          severity?: string;
          data?: Record<string, unknown>;
        };
        return previewDiscordEmbed({
          event: payload.event ?? lastSecurity.event,
          title: payload.title ?? lastSecurity.event,
          message: payload.message ?? lastSecurity.integrationName,
          severity: (payload.severity as "info" | "warning" | "critical") ?? "critical",
          data: payload.data,
        });
      } catch {
        /* fall through */
      }
    }
    return previewDiscordEmbed(
      buildEventPayload("security.critical", {
        type: "launcher_cheat_client",
        detail: "Cliente Wurst detectado en classpath",
        username: "CreeperBoom",
      })
    );
  }, [deliveries]);

  const toggleEvent = (event: string) => {
    setForm((prev) => ({
      ...prev,
      events: prev.events.includes(event) ? prev.events.filter((e) => e !== event) : [...prev.events, event],
    }));
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const openEdit = (item: Integration) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      type: item.type,
      url: item.url,
      description: item.description ?? "",
      events: [...item.events],
      telegramChatId: item.config?.telegramChatId ?? "",
      discordUsername: item.config?.discordUsername ?? "CraftLauncher",
      secretHeaderName: item.config?.secretHeaderName ?? "",
      secretHeaderValue: item.config?.secretHeaderValue ?? "",
      retryOnFail: item.config?.retryOnFail ?? false,
    });
    setShowForm(true);
  };

  const saveIntegration = async () => {
    const payload = {
      name: form.name,
      type: form.type as Integration["type"],
      url: form.url,
      events: form.events.length ? form.events : ["integration.test"],
      description: form.description,
      config: {
        telegramChatId: form.telegramChatId || undefined,
        discordUsername: form.discordUsername || undefined,
        secretHeaderName: form.secretHeaderName || undefined,
        secretHeaderValue: form.secretHeaderValue || undefined,
        retryOnFail: form.retryOnFail,
      },
    };

    const url = editingId ? `/api/integrations/${editingId}` : "/api/integrations";
    const method = editingId ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { success?: boolean; error?: string };
    if (!res.ok) {
      setError(data.error ?? "No se pudo guardar");
      return;
    }
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
    void refresh();
  };

  const deleteIntegration = async (id: string) => {
    if (!confirm("¿Eliminar esta integración?")) return;
    await fetch(`/api/integrations/${id}`, { method: "DELETE", credentials: "include" });
    void refresh();
  };

  const toggleActive = async (id: string, active: boolean) => {
    await fetch(`/api/integrations/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    void refresh();
  };

  const testWebhook = async (id: string) => {
    setTesting(id);
    setTestResult(null);
    try {
      const res = await fetch(`/api/integrations/${id}/test`, {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as { success?: boolean; error?: string; statusCode?: number };
      setTestResult(
        data.success
          ? `✓ Enviado (${data.statusCode ?? 200})`
          : `✗ Error: ${data.error ?? "falló"}`
      );
    } catch {
      setTestResult("✗ Error de red");
    } finally {
      setTesting(null);
      void refresh();
    }
  };

  return (
    <>
      <Header
        title="Integraciones"
        description="Discord, Telegram, Slack y webhooks — eventos en tiempo real"
        actions={
          <Button size="sm" variant="outline" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> Integración
          </Button>
        }
      />

      <PageContent>
        {error && (
          <p className="rounded-lg border border-[var(--color-danger-bg)] bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger-text)]">
            {error}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard title="Activas" value={loading ? "…" : (overview?.activeCount ?? 0)} icon={Webhook} />
          <StatCard title="Eventos hoy" value={loading ? "…" : (overview?.eventsToday ?? 0)} icon={Zap} />
          <StatCard
            title="Tasa éxito media"
            value={loading ? "…" : `${overview?.avgSuccessRate ?? 100}%`}
            trend={(overview?.successTrend ?? 0) >= 0 ? "up" : "down"}
            change={
              overview?.successTrend
                ? `${overview.successTrend > 0 ? "+" : ""}${overview.successTrend}% vs ayer`
                : undefined
            }
            icon={Send}
          />
        </div>

        <Tabs
          tabs={[
            { id: "integrations", label: "Integraciones" },
            { id: "deliveries", label: `Entregas (${deliveries.length})` },
            { id: "events", label: "Catálogo eventos" },
          ]}
          active={tab}
          onChange={setTab}
        />

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>{editingId ? "Editar integración" : "Nueva integración"}</CardTitle>
              <CardDescription>Los webhooks reciben eventos del ecosistema CraftLauncher automáticamente</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Input label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Select
                label="Tipo"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                options={[
                  { value: "discord", label: "Discord" },
                  { value: "telegram", label: "Telegram" },
                  { value: "slack", label: "Slack" },
                  { value: "custom", label: "Custom webhook" },
                ]}
              />
              <Input
                label="URL webhook"
                className="sm:col-span-2"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                hint="HTTPS obligatorio en producción"
              />
              <Textarea
                label="Descripción"
                className="sm:col-span-2"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              {form.type === "telegram" && (
                <Input
                  label="Telegram Chat ID"
                  value={form.telegramChatId}
                  onChange={(e) => setForm({ ...form, telegramChatId: e.target.value })}
                  hint="Requerido para Telegram Bot API"
                />
              )}
              {form.type === "discord" && (
                <Input
                  label="Nombre bot Discord"
                  value={form.discordUsername}
                  onChange={(e) => setForm({ ...form, discordUsername: e.target.value })}
                />
              )}
              <Input
                label="Header secreto (nombre)"
                value={form.secretHeaderName}
                onChange={(e) => setForm({ ...form, secretHeaderName: e.target.value })}
                hint="Opcional — ej: X-Webhook-Secret"
              />
              <Input
                label="Header secreto (valor)"
                value={form.secretHeaderValue}
                onChange={(e) => setForm({ ...form, secretHeaderValue: e.target.value })}
              />
              <label className="flex items-center gap-2 text-sm text-[var(--color-text-soft)] sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.retryOnFail}
                  onChange={(e) => setForm({ ...form, retryOnFail: e.target.checked })}
                />
                Reintentar automáticamente si falla el envío
              </label>
              <div className="sm:col-span-2">
                <p className="mb-2 text-xs text-[var(--color-text-soft)]">Eventos suscritos ({form.events.length})</p>
                <div className="flex flex-wrap gap-2">
                  {eventOptions.map((ev) => (
                    <button
                      key={ev}
                      type="button"
                      onClick={() => toggleEvent(ev)}
                      className={`rounded-lg border px-2.5 py-1 text-[11px] ${
                        form.events.includes(ev)
                          ? "border-[var(--color-accent-muted)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                          : "border-[var(--color-border-subtle)] text-[var(--color-muted)]"
                      }`}
                    >
                      {ev}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <Button onClick={() => void saveIntegration()}>{editingId ? "Guardar" : "Conectar"}</Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {testResult && (
          <p className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-hover)] px-3 py-2 text-sm">
            {testResult}
          </p>
        )}

        {tab === "integrations" && (
          <div className="grid gap-4 lg:grid-cols-2">
            {integrations.map((item) => {
              const Icon = typeIcons[item.type] ?? Webhook;
              return (
                <Card key={item.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-[var(--color-accent-soft)] p-2.5">
                          <Icon className="h-4 w-4 text-[var(--color-accent)]" strokeWidth={1.5} />
                        </div>
                        <div>
                          <CardTitle className="text-base">{item.name}</CardTitle>
                          <CardDescription className="capitalize">{item.type}</CardDescription>
                        </div>
                      </div>
                      <Toggle compact checked={item.active} onChange={(c) => void toggleActive(item.id, c)} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {item.description && (
                      <p className="text-xs text-[var(--color-text-soft)]">{item.description}</p>
                    )}
                    <p className="truncate font-mono text-[11px] text-[var(--color-muted)]">{item.url}</p>
                    <div className="flex flex-wrap gap-1">
                      {item.events.map((ev) => (
                        <Badge key={ev} className={badgeDefault}>
                          {ev}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-muted)]">
                      <span>
                        Éxito: {item.successRate}% · {item.totalDeliveries ?? 0} envíos
                      </span>
                      {item.lastTriggered && <span>Último: {formatRelativeTime(item.lastTriggered)}</span>}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        disabled={testing === item.id}
                        onClick={() => void testWebhook(item.id)}
                      >
                        {testing === item.id ? "Enviando…" : "Probar webhook"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(item)}>
                        Editar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void deleteIntegration(item.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {tab === "deliveries" && (
          <div className="space-y-2">
            {deliveries.map((d) => (
              <div key={d.id} className={rowItem}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    {d.success ? (
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-danger-text)]" />
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm text-[var(--color-text)]">{d.integrationName}</p>
                        <Badge className={badgeDefault}>{d.event}</Badge>
                        {d.statusCode && <span className="text-[10px] text-[var(--color-muted)]">HTTP {d.statusCode}</span>}
                      </div>
                      {d.error && <p className="mt-1 text-xs text-[var(--color-danger-text)]">{d.error}</p>}
                      <p className="mt-1 truncate font-mono text-[10px] text-[var(--color-muted)]">{d.payloadPreview}</p>
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-[var(--color-muted)]">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(d.createdAt)} · {d.durationMs}ms
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {!loading && deliveries.length === 0 && (
              <p className={rowItem}>Aún no hay entregas. Prueba un webhook o espera eventos del sistema.</p>
            )}
          </div>
        )}

        {tab === "events" && (
          <div className="grid gap-4 lg:grid-cols-2">
            {[...eventsByCategory.entries()].map(([category, list]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="text-base capitalize">{category}</CardTitle>
                  <CardDescription>{list.length} eventos disponibles</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {list.map((ev) => (
                    <div key={ev.id} className={`${rowItem} !py-3`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm text-[var(--color-text)]">{ev.label}</p>
                          <code className="text-[10px] text-[var(--color-muted)]">{ev.id}</code>
                          <p className="mt-1 text-xs text-[var(--color-text-soft)]">{ev.description}</p>
                        </div>
                        <Badge className={badgeDefault}>{ev.severity}</Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Vista previa Discord</CardTitle>
            <CardDescription>
              {deliveries.some((d) => d.event.startsWith("security."))
                ? "Último evento de seguridad entregado"
                : "Ejemplo de embed para alerta de seguridad"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`${rowItem} font-mono text-xs leading-relaxed text-[var(--color-text-soft)]`}>
              {discordPreview.map((line, i) => (
                <p key={i} className={i === 0 ? "text-[var(--color-accent)]" : i === 1 ? "mt-2 text-[var(--color-text)]" : "mt-1"}>
                  {line}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      </PageContent>
    </>
  );
}
