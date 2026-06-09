"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MiniBarChart } from "@/components/ui/MiniBarChart";
import { Avatar } from "@/components/ui/Avatar";
import {
  getDashboardStats,
  mockActivity,
  mockLaunchers,
  mockWeeklyActive,
  statusColors,
} from "@/lib/mock-data";
import { formatRelativeTime } from "@/lib/utils";
import { rowItem } from "@/lib/styles";
import type { AdminRoute } from "@/lib/page-registry-types";
import { Users, Monitor, Crown, Activity, Bell, Zap, RefreshCw, Shield } from "lucide-react";

const quickActions: { label: string; href: AdminRoute; icon: typeof Bell }[] = [
  { label: "Notificación", href: "/notifications", icon: Bell },
  { label: "Evento remoto", href: "/events", icon: Zap },
  { label: "Mantenimiento", href: "/settings", icon: Shield },
  { label: "Sync launchers", href: "/launchers", icon: RefreshCw },
];

export default function DashboardPage() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const stats = getDashboardStats();

  const go = (href: AdminRoute) => {
    startTransition(() => router.push(href, { scroll: false }));
  };

  return (
    <>
      <Header
        title="Dashboard"
        description="Centro de control"
        actions={<Button size="sm" variant="outline">Exportar</Button>}
      />

      <PageContent>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Usuarios" value={stats.totalUsers} change="+12 semana" icon={Users} trend="up" />
          <StatCard title="Online" value={stats.onlineUsers} change="Tiempo real" icon={Activity} trend="neutral" />
          <StatCard title="Launchers" value={stats.activeLaunchers} change="4 activos" icon={Monitor} trend="up" />
          <StatCard title="Premium" value={stats.premiumUsers} change={`${Math.round((stats.premiumUsers / stats.totalUsers) * 100)}%`} icon={Crown} trend="up" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Actividad semanal</CardTitle>
              <CardDescription>Usuarios activos por día</CardDescription>
            </CardHeader>
            <CardContent>
              <MiniBarChart data={mockWeeklyActive} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Acciones rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {quickActions.map(({ label, href, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  scroll={false}
                  onClick={(e) => {
                    e.preventDefault();
                    go(href);
                  }}
                  className={`flex items-center gap-3 ${rowItem} text-sm text-[var(--color-text-soft)] hover:text-[var(--color-text)]`}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                  {label}
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Launchers conectados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {mockLaunchers.map((launcher) => (
                <div key={launcher.id} className={`flex items-center justify-between gap-3 ${rowItem}`}>
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={launcher.username} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-[var(--color-text)]">{launcher.username}</p>
                      <p className="truncate text-xs text-[var(--color-muted)]">
                        {launcher.os} · v{launcher.version}
                        {launcher.minecraftVersion && ` · MC ${launcher.minecraftVersion}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="hidden text-[11px] text-[var(--color-muted)] sm:block">
                      {launcher.ramUsage}% · {launcher.cpuUsage}%
                    </span>
                    <Badge className={statusColors[launcher.status]}>{launcher.status}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actividad</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {mockActivity.map((item) => (
                <div key={item.id} className="border-l border-[var(--color-border)] pl-3">
                  <p className="text-sm text-[var(--color-text-soft)]">{item.message}</p>
                  <p className="text-[11px] text-[var(--color-muted)]">{formatRelativeTime(item.timestamp)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Mensajes hoy", value: stats.messagesToday },
            { label: "Eventos pendientes", value: stats.pendingEvents },
            { label: "Uptime", value: "99.2%" },
          ].map((item) => (
            <Card key={item.label}>
              <CardContent className="pt-6">
                <p className="text-2xl font-light text-[var(--color-text)]">{item.value}</p>
                <p className="text-xs text-[var(--color-muted)]">{item.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </PageContent>
    </>
  );
}
