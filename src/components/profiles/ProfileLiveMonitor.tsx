"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { badgeDefault } from "@/lib/styles";
import type { UserModerationIntel } from "@/lib/launcher-auth/profile-moderation";
import { formatModerationReport } from "@/lib/launcher-auth/profile-moderation";
import { formatRelativeTime } from "@/lib/utils";
import { Activity, Copy, MapPin, Monitor, Wifi, WifiOff } from "lucide-react";

const RISK_STYLES = {
  low: "bg-emerald-500/15 text-emerald-300",
  medium: "bg-amber-500/15 text-amber-200",
  high: "bg-red-500/20 text-red-300",
};

type ProfileLiveMonitorProps = {
  items: UserModerationIntel[];
  onSelectUser: (userId: string) => void;
  selectedId: string | null;
};

export function ProfileLiveSummary({ items }: { items: UserModerationIntel[] }) {
  const online = items.filter((m) => m.launcherOpen);
  const offline = items.filter((m) => !m.launcherOpen && m.activeSessionCount > 0);

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted)]">
      <span className="inline-flex items-center gap-1 text-emerald-300">
        <Wifi className="h-3.5 w-3.5" />
        {online.length} launcher(es) abierto(s) ahora
      </span>
      <span>·</span>
      <span>{offline.length} con sesión pero sin heartbeat reciente</span>
    </div>
  );
}

export function ProfileLiveMonitor({ items, onSelectUser, selectedId }: ProfileLiveMonitorProps) {
  const online = items.filter((m) => m.launcherOpen);
  const offline = items.filter((m) => !m.launcherOpen && m.activeSessionCount > 0);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <ProfileLiveSummary items={items} />

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
        {online.length === 0 ? (
          <div className="flex h-full min-h-[7rem] flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border-subtle)] px-4 text-center text-sm text-[var(--color-muted)]">
            <WifiOff className="mb-2 h-8 w-8 opacity-40" />
            Ningún launcher reportando actividad en los últimos 45 segundos.
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {online.map((intel) => (
              <LiveUserCard
                key={intel.userId}
                intel={intel}
                selected={selectedId === intel.userId}
                onSelect={() => onSelectUser(intel.userId)}
              />
            ))}
          </div>
        )}

        {offline.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
              Sesión activa sin launcher visible
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {offline.map((intel) => (
                <button
                  key={intel.userId}
                  type="button"
                  onClick={() => onSelectUser(intel.userId)}
                  className="flex items-center justify-between rounded-lg border border-[var(--color-border-subtle)] px-3 py-2 text-left text-sm hover:bg-[var(--color-surface-hover)]"
                >
                  <span>@{intel.username}</span>
                  <span className="text-xs text-[var(--color-muted)]">{intel.activeSessionCount} sesión</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LiveUserCard({
  intel,
  selected,
  onSelect,
}: {
  intel: UserModerationIntel;
  selected: boolean;
  onSelect: () => void;
}) {
  const device = intel.liveDevices[0];

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        selected
          ? "border-[var(--color-accent-muted)] bg-[var(--color-accent-soft)]/15"
          : "border-[var(--color-border-subtle)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar name={intel.displayName} size="md" />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--color-surface)] bg-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-medium">@{intel.username}</p>
            <p className="text-xs text-emerald-300">{intel.launcherStatusLabel}</p>
          </div>
        </div>
        <Badge className={RISK_STYLES[intel.riskLevel]}>Riesgo {intel.riskLevel}</Badge>
      </div>

      {device && (
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
          <Data label="IP" value={device.ip} mono />
          <Data label="País" value={`${device.city}, ${device.countryCode}`} />
          <Data label="SO" value={device.os} />
          <Data label="MC" value={device.minecraftVersion ?? "—"} />
          <Data label="RAM" value={`${device.ramUsage}%`} />
          <Data label="CPU" value={`${device.cpuUsage}%`} />
          <Data label="Device ID" value={device.deviceId.slice(0, 20) + "…"} mono />
          <Data label="Heartbeat" value={`hace ${device.secondsSinceHeartbeat}s`} />
        </dl>
      )}

      <div className="mt-3">
        <Button size="sm" variant="outline" onClick={onSelect}>
          <Monitor className="h-3.5 w-3.5" />
          Ver ficha de moderación
        </Button>
      </div>
    </div>
  );
}

function Data({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[var(--color-muted)]">{label}</dt>
      <dd className={`text-[var(--color-text-soft)] ${mono ? "font-mono text-[10px]" : ""}`}>{value}</dd>
    </div>
  );
}

export function ProfileModerationDetail({ intel }: { intel: UserModerationIntel }) {
  const fields: { label: string; value: string; highlight?: boolean }[] = [
    {
      label: "Estado cuenta",
      value: intel.accountRevoked ? "Revocada" : "Activa",
      highlight: intel.accountRevoked,
    },
    {
      label: "Launcher abierto",
      value: intel.launcherOpen
        ? `Sí — ${intel.launcherStatusLabel ?? "en línea"}`
        : "No (sin heartbeat)",
    },
    { label: "IP principal", value: intel.primaryIp ?? "—" },
    {
      label: "Ubicación",
      value:
        intel.primaryCity && intel.primaryCountry
          ? `${intel.primaryCity}, ${intel.primaryCountry}`
          : "—",
    },
    { label: "Sesiones activas", value: String(intel.activeSessionCount) },
    { label: "Dispositivos únicos", value: String(intel.uniqueDeviceCount) },
    { label: "IPs conocidas", value: intel.knownIps.join(" · ") || "—" },
    { label: "Huella dispositivo", value: intel.fingerprintPrefixes.join(" · ") || "—" },
    { label: "Logins fallidos (24 h)", value: String(intel.failedLogins24h) },
    { label: "Último IP fallido", value: intel.lastFailedLoginIp ?? "—" },
    { label: "Logins OK (7 días)", value: String(intel.successfulLogins7d) },
    { label: "Eventos auditoría (7 d)", value: String(intel.auditEvents7d) },
    {
      label: "Nivel de riesgo",
      value: intel.riskLevel.toUpperCase(),
      highlight: intel.riskLevel !== "low",
    },
    {
      label: "Última actividad",
      value: intel.lastSeenAt ? formatRelativeTime(intel.lastSeenAt) : "—",
    },
    {
      label: "Plan",
      value: intel.tier === "premium" ? "Premium" : "Free",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {intel.launcherOpen ? (
          <Badge className="bg-emerald-500/15 text-emerald-300">
            <Activity className="mr-1 h-3 w-3" />
            Launcher en vivo
          </Badge>
        ) : (
          <Badge className={badgeDefault}>Launcher cerrado</Badge>
        )}
        {intel.riskSignals.map((signal) => (
          <Badge key={signal} className="bg-amber-500/15 text-amber-200">
            {signal}
          </Badge>
        ))}
      </div>

      <dl className="grid gap-2 sm:grid-cols-2">
        {fields.map((f) => (
          <div
            key={f.label}
            className="rounded-lg border border-[var(--color-border-subtle)] px-3 py-2"
          >
            <dt className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{f.label}</dt>
            <dd
              className={`mt-0.5 text-sm ${
                f.highlight ? "text-red-300" : "text-[var(--color-text)]"
              } break-all font-mono text-xs`}
            >
              {f.value}
            </dd>
          </div>
        ))}
      </dl>

      {intel.liveDevices.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--color-text-soft)]">Dispositivos en vivo</p>
          {intel.liveDevices.map((d) => (
            <div
              key={d.deviceId}
              className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs"
            >
              <p className="font-medium text-emerald-200">{d.statusLabel}</p>
              <p className="mt-1 font-mono text-[var(--color-text-soft)]">
                {d.deviceId} · {d.os} · Launcher {d.launcherVersion}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-1 text-[var(--color-muted)]">
                <MapPin className="h-3 w-3" />
                {d.ip} · {d.city}, {d.country} · RAM {d.ramUsage}% · CPU {d.cpuUsage}% ·{" "}
                {d.uptimeMinutes} min conectado
              </p>
            </div>
          ))}
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => void navigator.clipboard.writeText(formatModerationReport(intel))}
      >
        <Copy className="h-3.5 w-3.5" />
        Copiar informe completo para moderación
      </Button>
    </div>
  );
}
