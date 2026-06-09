"use client";

import { useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { FilterPills } from "@/components/ui/FilterPills";
import { StatCard } from "@/components/ui/StatCard";
import {
  mockScheduledEvents,
  scheduleActionLabels,
} from "@/lib/feature-data";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import { badgeDefault, badgeDanger, badgeWarning, rowItem } from "@/lib/styles";
import { Calendar, Clock, Plus, Play, XCircle } from "lucide-react";
import type { ScheduleStatus, ScheduledEvent } from "@/types/features";

const statusFilters = [
  { id: "all", label: "Todos" },
  { id: "pending", label: "Pendientes" },
  { id: "running", label: "En curso" },
  { id: "completed", label: "Completados" },
];

const statusBadge: Record<ScheduleStatus, string> = {
  pending: badgeWarning,
  running: "bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-[var(--color-border-subtle)]",
  completed: "bg-[var(--color-surface-hover)] text-[var(--color-text-soft)] border-[var(--color-border-subtle)]",
  cancelled: badgeDanger,
};

export default function SchedulerPage() {
  const [events, setEvents] = useState(mockScheduledEvents);
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    action: "notification",
    scheduledAt: "",
    target: "all",
    recurring: "once",
    payload: "",
  });

  const filtered = useMemo(
    () => (filter === "all" ? events : events.filter((e) => e.status === filter)),
    [events, filter]
  );

  const pending = events.filter((e) => e.status === "pending").length;
  const running = events.filter((e) => e.status === "running").length;

  const addEvent = () => {
    if (!form.name || !form.scheduledAt) return;
    const newEvent: ScheduledEvent = {
      id: `sch${Date.now()}`,
      name: form.name,
      action: form.action as ScheduledEvent["action"],
      scheduledAt: new Date(form.scheduledAt).toISOString(),
      target: form.target as ScheduledEvent["target"],
      payload: form.payload ? { message: form.payload } : {},
      status: "pending",
      recurring: form.recurring as ScheduledEvent["recurring"],
    };
    setEvents((prev) => [newEvent, ...prev]);
    setForm({ name: "", action: "notification", scheduledAt: "", target: "all", recurring: "once", payload: "" });
    setShowForm(false);
  };

  const cancelEvent = (id: string) => {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, status: "cancelled" as const } : e)));
  };

  const runNow = (id: string) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: "running" as const } : e))
    );
    setTimeout(() => {
      setEvents((prev) =>
        prev.map((e) => (e.id === id ? { ...e, status: "completed" as const } : e))
      );
    }, 2000);
  };

  return (
    <>
      <Header
        title="Programador"
        description="Calendario de eventos automáticos del launcher"
        actions={
          <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> Programar
          </Button>
        }
      />

      <PageContent>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard title="Pendientes" value={pending} icon={Clock} />
          <StatCard title="En curso" value={running} icon={Play} />
          <StatCard title="Total programados" value={events.length} icon={Calendar} />
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Nuevo evento programado</CardTitle>
              <CardDescription>Se ejecutará automáticamente en la fecha indicada (UTC)</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Input label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Select
                label="Acción"
                value={form.action}
                onChange={(e) => setForm({ ...form, action: e.target.value })}
                options={Object.entries(scheduleActionLabels).map(([v, l]) => ({ value: v, label: l }))}
              />
              <Input
                label="Fecha y hora"
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
              />
              <Select
                label="Audiencia"
                value={form.target}
                onChange={(e) => setForm({ ...form, target: e.target.value })}
                options={[
                  { value: "all", label: "Todos" },
                  { value: "online", label: "Solo online" },
                  { value: "premium", label: "Solo premium" },
                ]}
              />
              <Select
                label="Recurrencia"
                value={form.recurring}
                onChange={(e) => setForm({ ...form, recurring: e.target.value })}
                options={[
                  { value: "once", label: "Una vez" },
                  { value: "daily", label: "Diario" },
                  { value: "weekly", label: "Semanal" },
                ]}
              />
              <Textarea
                label="Payload / mensaje"
                value={form.payload}
                onChange={(e) => setForm({ ...form, payload: e.target.value })}
                rows={2}
              />
              <div className="flex gap-2 sm:col-span-2">
                <Button onClick={addEvent}>Guardar</Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <FilterPills options={statusFilters} active={filter} onChange={setFilter} />

        <div className="space-y-2">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--color-muted)]">No hay eventos con este filtro</p>
          ) : (
            filtered.map((event) => (
              <div key={event.id} className={`flex flex-wrap items-start justify-between gap-4 ${rowItem}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm text-[var(--color-text)]">{event.name}</p>
                    <Badge className={badgeDefault}>{scheduleActionLabels[event.action]}</Badge>
                    <Badge className={statusBadge[event.status]}>{event.status}</Badge>
                    {event.recurring && event.recurring !== "once" && (
                      <Badge className={badgeDefault}>{event.recurring}</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-soft)]">
                    {formatDate(event.scheduledAt)} · Audiencia: {event.target}
                  </p>
                  {Object.keys(event.payload).length > 0 && (
                    <p className="mt-1 font-mono text-[11px] text-[var(--color-muted)]">
                      {JSON.stringify(event.payload)}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {event.status === "pending" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => runNow(event.id)}>Ejecutar ahora</Button>
                      <Button size="sm" variant="ghost" onClick={() => cancelEvent(event.id)}>
                        <XCircle className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </Button>
                    </>
                  )}
                  {event.status === "running" && (
                    <span className="text-xs text-[var(--color-accent)]">Ejecutando…</span>
                  )}
                  {event.status === "completed" && (
                    <span className="text-[11px] text-[var(--color-muted)]">{formatRelativeTime(event.scheduledAt)}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </PageContent>
    </>
  );
}
