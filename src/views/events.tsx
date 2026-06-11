"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea, Select } from "@/components/ui/Input";
import { useAdminStore } from "@/lib/store";
import { eventTypeLabels, statusColors } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";
import { rowItem } from "@/lib/styles";
import { Play } from "lucide-react";
import type { RemoteEventType } from "@/types";
import { reportAppError } from "@/lib/app-errors-store";

export default function EventsPage() {
  const { events, addEvent } = useAdminStore();
  const [eventType, setEventType] = useState<RemoteEventType>("broadcast_event");
  const [target, setTarget] = useState<"all" | "specific" | "online">("online");
  const [payload, setPayload] = useState('{"eventName": "double_xp", "multiplier": 2}');
  const handleTrigger = () => {
    try {
      const parsed = JSON.parse(payload) as Record<string, unknown>;
      addEvent({ type: eventType, payload: parsed, target });
    } catch {
      reportAppError("JSON inválido. Revisa la sintaxis del payload.");
    }
  };

  return (
    <>
      <Header title="Eventos" description="Acciones remotas en launchers conectados" />

      <PageContent>
        <Card>
          <CardHeader>
            <CardTitle>Disparar evento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <Select
                label="Tipo"
                value={eventType}
                onChange={(e) => setEventType(e.target.value as RemoteEventType)}
                options={Object.entries(eventTypeLabels).map(([value, label]) => ({ value, label }))}
              />
              <Select
                label="Destino"
                value={target}
                onChange={(e) => setTarget(e.target.value as typeof target)}
                options={[
                  { value: "all", label: "Todos" },
                  { value: "online", label: "Solo online" },
                  { value: "specific", label: "IDs específicos" },
                ]}
              />
              <div className="flex items-end">
                <Button className="w-full" onClick={handleTrigger}>
                  <Play className="h-3.5 w-3.5" strokeWidth={1.5} /> Ejecutar
                </Button>
              </div>
            </div>
            <Textarea
              label="Payload (JSON)"
              rows={4}
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              className="font-mono text-xs"
            />
          </CardContent>
        </Card>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(eventTypeLabels).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setEventType(key as RemoteEventType)}
              className={`rounded-xl border px-4 py-3 text-left ${
                eventType === key
                  ? "border-[var(--color-accent-muted)] bg-[var(--color-accent-soft)]"
                  : "border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] hover:bg-[var(--color-surface-hover)]"
              }`}
            >
              <p className="text-xs text-[var(--color-text-soft)]">{label}</p>
              <p className="mt-1 font-mono text-[10px] text-[var(--color-muted)]">{key}</p>
            </button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Historial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {events.map((event) => (
              <div key={event.id} className={rowItem}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm text-[var(--color-text)]">{eventTypeLabels[event.type]}</p>
                  <Badge className={statusColors[event.status]}>{event.status}</Badge>
                </div>
                <p className="mt-1 font-mono text-[11px] text-[var(--color-muted)]">
                  {JSON.stringify(event.payload)}
                </p>
                <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                  {formatDate(event.createdAt)} · {event.target} · {event.executedCount} ejecutados
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </PageContent>
    </>
  );
}
