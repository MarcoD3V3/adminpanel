"use client";

import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { MiniBarChart } from "@/components/ui/MiniBarChart";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { mockRetention, mockWeeklyActive } from "@/lib/mock-data";
import { TrendingUp, Clock, Gamepad2, Repeat } from "lucide-react";

export default function AnalyticsPage() {
  const peakDay = mockWeeklyActive.reduce((a, b) => (a.value > b.value ? a : b));

  return (
    <>
      <Header title="Analíticas" description="Métricas de uso y retención" />

      <PageContent>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Pico semanal" value={peakDay.value} change={peakDay.label} icon={TrendingUp} trend="up" />
          <StatCard title="Sesión media" value="2h 14m" change="Por usuario" icon={Clock} trend="neutral" />
          <StatCard title="Lanzamientos" value="97.8%" change="Sin errores" icon={Gamepad2} trend="up" />
          <StatCard title="Retención D7" value="52%" change="+3% vs anterior" icon={Repeat} trend="up" />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Activos diarios</CardTitle>
              <CardDescription>Últimos 7 días</CardDescription>
            </CardHeader>
            <CardContent>
              <MiniBarChart data={mockWeeklyActive} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Retención</CardTitle>
              <CardDescription>Usuarios que vuelven</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {mockRetention.map((point) => (
                <div key={point.label}>
                  <div className="mb-1.5 flex justify-between text-xs">
                    <span className="text-[var(--color-text-soft)]">{point.label}</span>
                    <span className="text-[var(--color-text)]">{point.value}%</span>
                  </div>
                  <ProgressBar value={point.value} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Insights</CardTitle>
            <CardDescription>Detectados esta semana</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              "68% de premium juega fines de semana",
              "MC 1.21.4 concentra 74% de lanzamientos",
              "Chat pico a las 21:00",
              "12 abandonos por Java incorrecto",
              "Forge 1.20.1 +23% descargas",
              "Retención D1 mejoró tras bienvenida",
            ].map((insight) => (
              <p
                key={insight}
                className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-soft)]"
              >
                {insight}
              </p>
            ))}
          </CardContent>
        </Card>
      </PageContent>
    </>
  );
}
