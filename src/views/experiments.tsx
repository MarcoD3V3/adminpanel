"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatCard } from "@/components/ui/StatCard";
import { mockExperiments } from "@/lib/feature-data";
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

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState(mockExperiments);
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

  const running = experiments.filter((e) => e.status === "running").length;

  const toggleStatus = (id: string, status: Experiment["status"]) => {
    setExperiments((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)));
  };

  const addExperiment = () => {
    if (!form.name || !form.key) return;
    const exp: Experiment = {
      id: `ex${Date.now()}`,
      name: form.name,
      key: form.key,
      description: form.description,
      status: "draft",
      variantA: form.variantA,
      variantB: form.variantB,
      rolloutPercent: Number(form.rolloutPercent) || 50,
      metric: form.metric as Experiment["metric"],
      resultA: 0,
      resultB: 0,
    };
    setExperiments((prev) => [exp, ...prev]);
    setForm({ name: "", key: "", description: "", variantA: "Control", variantB: "Variante B", metric: "retention", rolloutPercent: "50" });
    setShowForm(false);
  };

  const getWinner = (exp: Experiment) => {
    if (exp.winner) return exp.winner;
    if (exp.resultA === exp.resultB) return null;
    return exp.resultA > exp.resultB ? "A" : "B";
  };

  return (
    <>
      <Header
        title="Experimentos A/B"
        description="Pruebas controladas con métricas de impacto"
        actions={
          <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> Experimento
          </Button>
        }
      />

      <PageContent>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard title="En ejecución" value={running} icon={FlaskConical} />
          <StatCard title="Completados" value={experiments.filter((e) => e.status === "completed").length} icon={Trophy} />
          <StatCard title="Usuarios en tests" value="~4.2k" change="30% del tráfico" trend="neutral" icon={Play} />
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Nuevo experimento</CardTitle>
              <CardDescription>Define variantes y métrica principal a medir</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Input label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input label="Feature key" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} hint="ej: new_ui_v2" />
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
                <Button onClick={addExperiment}>Crear borrador</Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {experiments.map((exp) => {
            const winner = getWinner(exp);
            const lift = exp.resultA > 0 ? Math.round(((exp.resultB - exp.resultA) / exp.resultA) * 100) : 0;

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
                        <Button size="sm" onClick={() => toggleStatus(exp.id, "running")}><Play className="h-3 w-3" /> Iniciar</Button>
                      )}
                      {exp.status === "running" && (
                        <Button size="sm" variant="outline" onClick={() => toggleStatus(exp.id, "paused")}><Pause className="h-3 w-3" /> Pausar</Button>
                      )}
                      {exp.status === "paused" && (
                        <Button size="sm" onClick={() => toggleStatus(exp.id, "running")}><Play className="h-3 w-3" /> Reanudar</Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-[var(--color-muted)]">
                    <span>{metricLabels[exp.metric]}</span>
                    <span>Rollout: {exp.rolloutPercent}%</span>
                    {exp.startedAt && <span>Inicio: {formatRelativeTime(exp.startedAt)}</span>}
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
                      <p className="mt-2 text-2xl font-light text-[var(--color-text)]">{exp.resultA}{exp.metric.includes("rate") || exp.metric === "retention" || exp.metric === "conversion" ? "%" : ""}</p>
                      <ProgressBar value={exp.rolloutPercent / 2} className="mt-3" />
                    </div>
                    <div className={`rounded-xl border p-4 ${winner === "B" ? "border-[var(--color-accent-muted)] bg-[var(--color-accent-soft)]/20" : "border-[var(--color-border-subtle)]"}`}>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-[var(--color-text)]">{exp.variantB}</p>
                        {winner === "B" && <Badge className={badgeDefault}>Ganador</Badge>}
                      </div>
                      <p className="mt-2 text-2xl font-light text-[var(--color-text)]">{exp.resultB}{exp.metric.includes("rate") || exp.metric === "retention" || exp.metric === "conversion" ? "%" : ""}</p>
                      <ProgressBar value={exp.rolloutPercent / 2} className="mt-3" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </PageContent>
    </>
  );
}
