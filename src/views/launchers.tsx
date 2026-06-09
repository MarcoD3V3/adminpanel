"use client";

import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { mockLaunchers, statusColors } from "@/lib/mock-data";
import { formatRelativeTime } from "@/lib/utils";
import { rowItem } from "@/lib/styles";
import { RefreshCw, Power, Download, MessageSquare, ExternalLink } from "lucide-react";

export default function LaunchersPage() {
  const handleAction = (action: string, launcherId: string) => {
    alert(`Acción "${action}" enviada al launcher ${launcherId}.`);
  };

  return (
    <>
      <Header title="Launchers" description="Control remoto de instancias conectadas" />

      <PageContent>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-[var(--color-text-soft)]">
            {mockLaunchers.length} instancias · sync cada 30s
          </p>
          <Button variant="outline" size="sm">
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} /> Refrescar
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {mockLaunchers.map((launcher) => (
            <Card key={launcher.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={launcher.username} />
                    <div className="min-w-0">
                      <CardTitle>{launcher.username}</CardTitle>
                      <p className="text-xs text-[var(--color-muted)]">ID: {launcher.id}</p>
                    </div>
                  </div>
                  <Badge className={statusColors[launcher.status]}>{launcher.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className={rowItem}>
                    <p className="text-[11px] text-[var(--color-muted)]">Sistema</p>
                    <p className="mt-1 text-[var(--color-text)]">{launcher.os}</p>
                  </div>
                  <div className={rowItem}>
                    <p className="text-[11px] text-[var(--color-muted)]">Versión</p>
                    <p className="mt-1 text-[var(--color-text)]">v{launcher.version}</p>
                  </div>
                  <div className={rowItem}>
                    <p className="text-[11px] text-[var(--color-muted)]">RAM {launcher.ramUsage}%</p>
                    <ProgressBar value={launcher.ramUsage} className="mt-2" />
                  </div>
                  <div className={rowItem}>
                    <p className="text-[11px] text-[var(--color-muted)]">CPU {launcher.cpuUsage}%</p>
                    <ProgressBar value={launcher.cpuUsage} className="mt-2" />
                  </div>
                </div>

                <p className="text-xs text-[var(--color-muted)]">
                  {launcher.ip} · {formatRelativeTime(launcher.connectedAt)}
                </p>

                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => handleAction("restart", launcher.id)}>
                    <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} /> Reiniciar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleAction("kill_game", launcher.id)}>
                    <Power className="h-3.5 w-3.5" strokeWidth={1.5} /> Cerrar MC
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleAction("force_update", launcher.id)}>
                    <Download className="h-3.5 w-3.5" strokeWidth={1.5} /> Actualizar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleAction("send_message", launcher.id)}>
                    <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.5} /> Mensaje
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleAction("open_url", launcher.id)}>
                    <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </PageContent>
    </>
  );
}
