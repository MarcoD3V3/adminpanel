"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { mockAutomationRules } from "@/lib/mock-data";
import { formatRelativeTime } from "@/lib/utils";
import { badgeDefault, rowItem } from "@/lib/styles";
import { Plus, Webhook } from "lucide-react";

export default function AutomationPage() {
  const [tab, setTab] = useState("rules");
  const [rules, setRules] = useState(mockAutomationRules);
  const [webhooks, setWebhooks] = useState([
    { id: "w1", url: "https://discord.com/api/webhooks/...", events: ["user.ban", "chat.flag"], active: true },
    { id: "w2", url: "https://api.example.com/launcher-events", events: ["launcher.crash"], active: false },
  ]);
  const [wordFilter, setWordFilter] = useState(true);
  const [spamDetect, setSpamDetect] = useState(true);
  const [blockLinks, setBlockLinks] = useState(true);
  const [slowMode, setSlowMode] = useState(false);

  return (
    <>
      <Header
        title="Automatización"
        description="Reglas, programador y webhooks"
        actions={<Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> Regla</Button>}
      />

      <PageContent>
        <Tabs
          tabs={[
            { id: "rules", label: "Reglas" },
            { id: "scheduler", label: "Programador" },
            { id: "webhooks", label: "Webhooks" },
            { id: "moderation", label: "Moderación" },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === "rules" && (
          <div className="space-y-2">
            {rules.map((rule) => (
              <div key={rule.id} className={`flex items-center justify-between gap-4 ${rowItem}`}>
                <div className="min-w-0">
                  <p className="text-sm text-[var(--color-text)]">{rule.name}</p>
                  <p className="text-xs text-[var(--color-text-soft)]">
                    Si <span className="text-[var(--color-accent)]">{rule.trigger}</span> → {rule.action}
                  </p>
                  {rule.lastRun && (
                    <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                      {formatRelativeTime(rule.lastRun)}
                    </p>
                  )}
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

        {tab === "scheduler" && (
          <Card>
            <CardHeader>
              <CardTitle>Programar acción</CardTitle>
              <CardDescription>Fecha y hora exacta (UTC)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                label="Acción"
                options={[
                  { value: "maintenance", label: "Mantenimiento" },
                  { value: "notification", label: "Notificación" },
                  { value: "force_update", label: "Forzar update" },
                  { value: "broadcast", label: "Broadcast" },
                ]}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Fecha" type="date" />
                <Input label="Hora" type="time" />
              </div>
              <Textarea label="Payload" rows={3} placeholder='{"message": "..."}' />
              <Button>Programar</Button>
            </CardContent>
          </Card>
        )}

        {tab === "webhooks" && (
          <div className="space-y-3">
            {webhooks.map((wh) => (
              <div key={wh.id} className={`flex items-center justify-between gap-4 ${rowItem}`}>
                <div className="flex min-w-0 items-start gap-3">
                  <Webhook className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-muted)]" strokeWidth={1.5} />
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-[var(--color-text-soft)]">{wh.url}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {wh.events.map((ev) => (
                        <Badge key={ev} className={badgeDefault}>{ev}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <Toggle
                  compact
                  checked={wh.active}
                  onChange={(checked) =>
                    setWebhooks((prev) => prev.map((w) => (w.id === wh.id ? { ...w, active: checked } : w)))
                  }
                />
              </div>
            ))}
            <Card>
              <CardContent className="space-y-4 pt-6">
                <Input label="URL" placeholder="https://..." />
                <Input label="Eventos" placeholder="user.ban, chat.flag" />
                <Button variant="outline" size="sm">Añadir</Button>
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "moderation" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Toggle label="Palabras prohibidas" checked={wordFilter} onChange={setWordFilter} />
                <Toggle label="Anti-spam" checked={spamDetect} onChange={setSpamDetect} />
                <Toggle label="Bloquear links" checked={blockLinks} onChange={setBlockLinks} />
                <Toggle label="Slow mode" checked={slowMode} onChange={setSlowMode} />
                <Textarea label="Lista negra" rows={4} placeholder="Una por línea..." />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Acciones</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Select
                  label="Tras 3 flagged"
                  options={[
                    { value: "mute_1h", label: "Silenciar 1h" },
                    { value: "mute_24h", label: "Silenciar 24h" },
                    { value: "ban", label: "Ban" },
                    { value: "review", label: "Revisión manual" },
                  ]}
                />
                <Select
                  label="Tras reporte"
                  options={[
                    { value: "notify", label: "Notificar admin" },
                    { value: "hide", label: "Ocultar mensaje" },
                    { value: "ban", label: "Ban inmediato" },
                  ]}
                />
                <Button>Guardar</Button>
              </CardContent>
            </Card>
          </div>
        )}
      </PageContent>
    </>
  );
}
