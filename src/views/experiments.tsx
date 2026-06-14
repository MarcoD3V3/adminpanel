"use client";

import { useCallback, useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatCard } from "@/components/ui/StatCard";
import { formatRelativeTime } from "@/lib/utils";
import { badgeDefault, badgeWarning, rowItem } from "@/lib/styles";
import { FlaskConical, Pause, Play, Plus, Trophy } from "lucide-react";
import type { Experiment } from "@/types/features";

const metricLabels: Record<string, string> = {
  retention: "Retención (%)",
  crash_rate: "Tasa de crash (%)",
  session_time: "Tiempo sesión (min)",
  conversion: "Conversión (%)",
};

const statusBadge: Record<string, string> = {
  draft: "bg-[var(--color-surface-hover)] text-[var(--color-text-soft)] border-[var(--color-border-subtle)]",
  running: "bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-[var(--color-border-subtle)]",
  paused: badgeWarning,
  completed: "bg-[var(--color-surface-hover)] text-[var(--color-text-soft)] border-[var(--color-border-subtle)]",
};

type ExperimentOverview = {
  running: number;
  completed: number;
  usersInTests: number;
  trafficPercent: number;
};

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [overview, setOverview] = useState<ExperimentOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    key: "",
    description: "",
    variantA: "Control",
    variantB: "Variante B",
    metric: "retention",
    rolloutPercent: "50",
  });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/experiments", { credentials: "include", cache: "no-store" });
      const data = (await res.json()) as {
        experiments?: Experiment[];
        overview?: ExperimentOverview;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "No se pudieron cargar los experimentos");
        return;
      }
      setExperiments(data.experiments ?? []);
      setOverview(data.overview ?? null);
      setError(null);
    } catch {
      setError("Error de red al cargar experimentos");
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

  const toggleStatus = async (id: string, status: Experiment["status"]) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/experiments/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await res.json()) as { success?: boolean; experiment?: Experiment; error?: string };
      if (!res.ok || !data.experiment) {
        setError(data.error ?? "No se pudo actualizar el experimento");
        return;
      }
      setExperiments((prev) => prev.map((e) => (e.id === id ? data.experiment! : e)));
      void refresh();
    } catch {
      setError("Error de red al actualizar");
    } finally {
      setSaving(false);
    }
  };

  const addExperiment = async () => {
    if (!form.name || !form.key) return;
    setSaving(true);
    try {
      const res = await fetch("/api/experiments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          key: form.key,
          description: form.description,
          variantA: form.variantA,
          variantB: form.variantB,
          metric: form.metric,
          rolloutPercent: Number(form.rolloutPercent) || 50,
        }),
      });
      const data = (await res.json()) as { success?: boolean; experiment?: Experiment; error?: string };
      if (!res.ok || !data.experiment) {
        setError(data.error ?? "No se pudo crear el experimento");
        return;
      }
      setForm({
        name: "",
        key: "",
        description: "",
        variantA: "Control",
        variantB: "Variante B",
        metric: "retention",
        rolloutPercent: "50",
      });
      setShowForm(false);
      void refresh();
    } catch {
      setError("Error de red al crear");
    } finally {
      setSaving(false);
    }
  };

  const getWinner = (exp: Experiment) => {
    if (exp.winner) return exp.winner;
    if (exp.resultA === exp.resultB) return null;
    const lowerBetter = exp.metric === "crash_rate";
    if (lowerBetter) return exp.resultA < exp.resultB ? "A" : "B";
    return exp.resultA > exp.resultB ? "A" : "B";
  };

  const usersLabel =
    overview && overview.usersInTests > 0
      ? overview.usersInTests >= 1000
        ? `~${(overview.usersInTests / 1000).toFixed(1)}k`
        : String(overview.usersInTests)
      : "0";

  return (
    <>
      <Header
        title="Experimentos A/B"
        description="Pruebas controladas con métricas de impacto en vivo"
        actions={
          <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)} disabled={saving}>
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> Experimento
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
          <StatCard title="En ejecución" value={overview?.running ?? 0} icon={FlaskConical} />
          <StatCard title="Completados" value={overview?.completed ?? 0} icon={Trophy} />
          <StatCard
            title="Usuarios en tests"
            value={loading ? "…" : usersLabel}
            change={
              overview?.trafficPercent
                ? `${overview.trafficPercent}% del tráfico`
                : "Sin tests activos"
            }
            trend="neutral"
            icon={Play}
          />
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Nuevo experimento</CardTitle>
              <CardDescription>Define variantes y métrica principal a medir</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Input label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input label="Feature key" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} hint="ej: new_ui_v2, big_play_btn" />
              <Input label="Variante A" value={form.variantA} onChange={(e) => setForm({ ...form, variantA: e.target.value })} />
              <Input label="Variante B" value={form.variantB} onChange={(e) => setForm({ ...form, variantB: e.target.value })} />
              <Select
                label="Métrica"
                value={form.metric}
                onChange={(e) => setForm({ ...form, metric: e.target.value })}
                options={Object.entries(metricLabels).map(([v, l]) => ({ value: v, label: l }))}
              />
              <Input label="Rollout (%)" value={form.rolloutPercent} onChange={(e) => setForm({ ...form, rolloutPercent: e.target.value })} />
              <Textarea label="Descripción" className="sm:col-span-2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
              <div className="flex gap-2 sm:col-span-2">
                <Button onClick={() => void addExperiment()} disabled={saving}>Crear borrador</Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {experiments.map((exp) => {
            const winner = getWinner(exp);
            const lift = exp.resultA > 0 ? Math.round(((exp.resultB - exp.resultA) / exp.resultA) * 100) : 0;
            const maxResult = Math.max(exp.resultA, exp.resultB, 1);

            return (
              <Card key={exp.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">{exp.name}</CardTitle>
                        <Badge className={statusBadge[exp.status]}>{exp.status}</Badge>
                        <code className="rounded bg-[var(--color-surface-hover)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">{exp.key}</code>
                      </div>
                      <CardDescription className="mt-1">{exp.description}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {exp.status === "draft" && (
                        <Button size="sm" onClick={() => void toggleStatus(exp.id, "running")} disabled={saving}>
                          <Play className="h-3 w-3" /> Iniciar
                        </Button>
                      )}
                      {exp.status === "running" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => void toggleStatus(exp.id, "paused")} disabled={saving}>
                            <Pause className="h-3 w-3" /> Pausar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => void toggleStatus(exp.id, "completed")} disabled={saving}>
                            <Trophy className="h-3 w-3" /> Finalizar
                          </Button>
                        </>
                      )}
                      {exp.status === "paused" && (
                        <Button size="sm" onClick={() => void toggleStatus(exp.id, "running")} disabled={saving}>
                          <Play className="h-3 w-3" /> Reanudar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-[var(--color-muted)]">
                    <span>{metricLabels[exp.metric]}</span>
                    <span>Rollout: {exp.rolloutPercent}%</span>
                    {exp.startedAt && <span>Inicio: {formatRelativeTime(exp.startedAt)}</span>}
                    {exp.status === "running" && <span className="text-[var(--color-accent)]">● En vivo</span>}
                    {exp.status !== "draft" && lift !== 0 && (
                      <span className={lift > 0 ? "text-[var(--color-accent-hover)]" : "text-[var(--color-text-soft)]"}>
                        Lift B vs A: {lift > 0 ? "+" : ""}{lift}%
                      </span>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className={`rounded-xl border p-4 ${winner === "A" ? "border-[var(--color-accent-muted)] bg-[var(--color-accent-soft)]/20" : "border-[var(--color-border-subtle)]"}`}>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-[var(--color-text)]">{exp.variantA}</p>
                        {winner === "A" && <Badge className={badgeDefault}>Ganador</Badge>}
                      </div>
                      <p className="mt-2 text-2xl font-light text-[var(--color-text)]">
                        {exp.resultA}
                        {exp.metric.includes("rate") || exp.metric === "retention" || exp.metric === "conversion" ? "%" : exp.metric === "session_time" ? " min" : ""}
                      </p>
                      <ProgressBar value={(exp.resultA / maxResult) * 100} className="mt-3" />
                    </div>
                    <div className={`rounded-xl border p-4 ${winner === "B" ? "border-[var(--color-accent-muted)] bg-[var(--color-accent-soft)]/20" : "border-[var(--color-border-subtle)]"}`}>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-[var(--color-text)]">{exp.variantB}</p>
                        {winner === "B" && <Badge className={badgeDefault}>Ganador</Badge>}
                      </div>
                      <p className="mt-2 text-2xl font-light text-[var(--color-text)]">
                        {exp.resultB}
                        {exp.metric.includes("rate") || exp.metric === "retention" || exp.metric === "conversion" ? "%" : exp.metric === "session_time" ? " min" : ""}
                      </p>
                      <ProgressBar value={(exp.resultB / maxResult) * 100} className="mt-3" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {!loading && experiments.length === 0 && (
            <p className={rowItem}>No hay experimentos. Crea uno para empezar a probar variantes en el launcher.</p>
          )}
        </div>
      </PageContent>
    </>
  );
}
