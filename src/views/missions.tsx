"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { FilterPills } from "@/components/ui/FilterPills";
import { StatCard } from "@/components/ui/StatCard";
import { missionMetricLabels } from "@/lib/feature-data";
import { badgeDefault, badgeWarning, rowItem } from "@/lib/styles";
import { formatDate } from "@/lib/utils";
import { Plus, Target, Trophy, Users } from "lucide-react";
import type { Mission, MissionType } from "@/types/features";

const typeFilters = [
  { id: "all", label: "Todas" },
  { id: "daily", label: "Diarias" },
  { id: "weekly", label: "Semanales" },
  { id: "special", label: "Especiales" },
];

const typeBadge: Record<MissionType, string> = {
  daily: "bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-[var(--color-border-subtle)]",
  weekly: badgeWarning,
  special: badgeDefault,
};

export default function MissionsPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "daily",
    metric: "play_time",
    target: "60",
    rewardPoints: "50",
  });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/missions", { credentials: "include", cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { missions?: Mission[] };
      setMissions(data.missions ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(
    () => (filter === "all" ? missions : missions.filter((m) => m.type === filter)),
    [missions, filter]
  );

  const totalCompletions = missions.reduce((s, m) => s + m.completions, 0);
  const activeCount = missions.filter((m) => m.active).length;

  async function addMission() {
    if (!form.title) return;
    await fetch("/api/missions", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        description: form.description,
        type: form.type,
        metric: form.metric,
        target: Number(form.target) || 1,
        rewardPoints: Number(form.rewardPoints) || 25,
        active: true,
      }),
    });
    setForm({ title: "", description: "", type: "daily", metric: "play_time", target: "60", rewardPoints: "50" });
    setShowForm(false);
    void refresh();
  }

  async function toggleMission(id: string, active: boolean) {
    await fetch("/api/missions", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active }),
    });
    setMissions((prev) => prev.map((m) => (m.id === id ? { ...m, active } : m)));
  }

  return (
    <>
      <Header
        title="Misiones"
        description="Misiones diarias, semanales y especiales con recompensas"
        actions={
          <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> Misión
          </Button>
        }
      />

      <PageContent>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard title="Activas" value={loading ? "…" : activeCount} icon={Target} />
          <StatCard title="Completadas (total)" value={loading ? "…" : totalCompletions.toLocaleString()} icon={Trophy} />
          <StatCard title="Misiones totales" value={loading ? "…" : missions.length} icon={Users} />
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Crear misión</CardTitle>
              <CardDescription>Los puntos se acreditan automáticamente al completar</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Input label="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <Select
                label="Tipo"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                options={[
                  { value: "daily", label: "Diaria" },
                  { value: "weekly", label: "Semanal" },
                  { value: "special", label: "Especial" },
                ]}
              />
              <Textarea
                label="Descripción"
                className="sm:col-span-2"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
              <Select
                label="Métrica"
                value={form.metric}
                onChange={(e) => setForm({ ...form, metric: e.target.value })}
                options={Object.entries(missionMetricLabels).map(([v, l]) => ({ value: v, label: l }))}
              />
              <Input label="Objetivo (número)" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />
              <Input label="Puntos recompensa" value={form.rewardPoints} onChange={(e) => setForm({ ...form, rewardPoints: e.target.value })} />
              <div className="flex gap-2 sm:col-span-2">
                <Button onClick={() => void addMission()}>Crear</Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <FilterPills options={typeFilters} active={filter} onChange={setFilter} />

        <div className="space-y-2">
          {loading && <p className="text-sm text-[var(--color-muted)]">Cargando misiones…</p>}
          {filtered.map((mission) => (
            <div key={mission.id} className={`flex items-start justify-between gap-4 ${rowItem}`}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm text-[var(--color-text)]">{mission.title}</p>
                  <Badge className={typeBadge[mission.type]}>{mission.type}</Badge>
                  <Badge className={badgeDefault}>{mission.rewardPoints} pts</Badge>
                </div>
                <p className="mt-1 text-xs text-[var(--color-text-soft)]">{mission.description}</p>
                <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                  {missionMetricLabels[mission.metric]}: {mission.target}
                  {mission.expiresAt && ` · Expira ${formatDate(mission.expiresAt)}`}
                </p>
                <p className="mt-1 text-[11px] text-[var(--color-accent)]">
                  {mission.completions.toLocaleString()} completadas
                </p>
              </div>
              <Toggle
                compact
                checked={mission.active}
                onChange={(checked) => void toggleMission(mission.id, checked)}
              />
            </div>
          ))}
        </div>
      </PageContent>
    </>
  );
}
