"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { StatCard } from "@/components/ui/StatCard";
import { mockIntegrations } from "@/lib/feature-data";
import { formatRelativeTime } from "@/lib/utils";
import { badgeDefault, rowItem } from "@/lib/styles";
import { Link2, MessageSquare, Plus, Send, Webhook, Zap } from "lucide-react";
import type { Integration } from "@/types/features";

const eventOptions = [
  "user.ban", "user.register", "security.critical", "liveops.alert",
  "launcher.crash", "maintenance.start", "experiment.completed", "modpack.publish", "chat.flag",
];

const typeIcons: Record<string, typeof Webhook> = {
  discord: MessageSquare,
  telegram: Send,
  slack: Link2,
  custom: Webhook,
};

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState(mockIntegrations);
  const [showForm, setShowForm] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", type: "discord", url: "", events: [] as string[] });

  const activeCount = integrations.filter((i) => i.active).length;

  const testWebhook = async (id: string) => {
    setTesting(id);
    await new Promise((r) => setTimeout(r, 1200));
    setTesting(null);
    setIntegrations((prev) =>
      prev.map((i) => (i.id === id ? { ...i, lastTriggered: new Date().toISOString() } : i))
    );
  };

  const toggleEvent = (event: string) => {
    setForm((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  const addIntegration = () => {
    if (!form.name || !form.url) return;
    const item: Integration = {
      id: `i${Date.now()}`,
      name: form.name,
      type: form.type as Integration["type"],
      url: form.url,
      events: form.events.length ? form.events : ["launcher.crash"],
      active: true,
      successRate: 100,
    };
    setIntegrations((prev) => [item, ...prev]);
    setForm({ name: "", type: "discord", url: "", events: [] });
    setShowForm(false);
  };

  return (
    <>
      <Header
        title="Integraciones"
        description="Discord, Telegram, Slack y webhooks personalizados"
        actions={
          <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> Integración
          </Button>
        }
      />

      <PageContent>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard title="Activas" value={activeCount} icon={Webhook} />
          <StatCard title="Eventos hoy" value={47} icon={Zap} />
          <StatCard title="Tasa éxito media" value="98.2%" trend="up" change="+0.3%" icon={Send} />
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Nueva integración</CardTitle>
              <CardDescription>Recibe eventos del launcher en tiempo real</CardDescription>
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
              <Input label="URL webhook" className="sm:col-span-2" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
              <div className="sm:col-span-2">
                <p className="mb-2 text-xs text-[var(--color-text-soft)]">Eventos suscritos</p>
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
                <Button onClick={addIntegration}>Conectar</Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </CardContent>
          </Card>
        )}

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
                    <Toggle
                      compact
                      checked={item.active}
                      onChange={(checked) =>
                        setIntegrations((prev) => prev.map((i) => (i.id === item.id ? { ...i, active: checked } : i)))
                      }
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="truncate font-mono text-[11px] text-[var(--color-muted)]">{item.url}</p>
                  <div className="flex flex-wrap gap-1">
                    {item.events.map((ev) => (
                      <Badge key={ev} className={badgeDefault}>{ev}</Badge>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs text-[var(--color-muted)]">
                    <span>Éxito: {item.successRate}%</span>
                    {item.lastTriggered && <span>Último: {formatRelativeTime(item.lastTriggered)}</span>}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={testing === item.id}
                    onClick={() => testWebhook(item.id)}
                  >
                    {testing === item.id ? "Enviando…" : "Probar webhook"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Vista previa Discord</CardTitle>
            <CardDescription>Ejemplo de embed para alerta de seguridad</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`${rowItem} font-mono text-xs leading-relaxed text-[var(--color-text-soft)]`}>
              <p className="text-[var(--color-accent)]">🔴 security.critical</p>
              <p className="mt-2 text-[var(--color-text)]">Cliente hackeado detectado</p>
              <p className="mt-1">Usuario: CreeperBoom</p>
              <p>Detalle: Wurst Client en classpath</p>
              <p className="mt-2 text-[var(--color-muted)]">CraftLauncher Admin · hace 2 min</p>
            </div>
          </CardContent>
        </Card>
      </PageContent>
    </>
  );
}
