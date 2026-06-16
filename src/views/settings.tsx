"use client";

import { useCallback, useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";
import { Tabs } from "@/components/ui/Tabs";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { badgeDefault } from "@/lib/styles";
import {
  Database,
  Link2,
  RefreshCw,
  Save,
  Server,
  Shield,
  Zap,
} from "lucide-react";
import type { SettingsDashboard, SystemSettingsPublic } from "@/lib/settings/types";

type FormState = {
  apiUrl: string;
  wsUrl: string;
  minLauncherVersion: string;
  latestLauncherVersion: string;
  oauthMode: string;
  clientId: string;
  redirectUri: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  forceUpdate: boolean;
  verifyHwid: boolean;
  anticheatEnabled: boolean;
  launcherAuthEnforced: boolean;
  experimentsEnabled: boolean;
  notificationsEnabled: boolean;
  chatEnabled: boolean;
  integrationsEnabled: boolean;
  serverName: string;
  supportUrl: string;
  launcherDownloadUrl: string;
};

function toForm(settings: SystemSettingsPublic): FormState {
  return {
    apiUrl: settings.api.apiUrl,
    wsUrl: settings.api.wsUrl,
    minLauncherVersion: settings.api.minLauncherVersion,
    latestLauncherVersion: settings.api.latestLauncherVersion,
    oauthMode: settings.oauth.mode,
    clientId: settings.oauth.clientId,
    redirectUri: settings.oauth.redirectUri,
    maintenanceMode: settings.security.maintenanceMode,
    maintenanceMessage: settings.security.maintenanceMessage,
    forceUpdate: settings.security.forceUpdate,
    verifyHwid: settings.security.verifyHwid,
    anticheatEnabled: settings.security.anticheatEnabled,
    launcherAuthEnforced: settings.security.launcherAuthEnforced,
    experimentsEnabled: settings.features.experimentsEnabled,
    notificationsEnabled: settings.features.notificationsEnabled,
    chatEnabled: settings.features.chatEnabled,
    integrationsEnabled: settings.features.integrationsEnabled,
    serverName: settings.branding.serverName,
    supportUrl: settings.branding.supportUrl,
    launcherDownloadUrl: settings.branding.launcherDownloadUrl,
  };
}

export default function SettingsPage() {
  const [tab, setTab] = useState("api");
  const [dashboard, setDashboard] = useState<SettingsDashboard | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dbTest, setDbTest] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/settings", { credentials: "include", cache: "no-store" });
      const data = (await res.json()) as SettingsDashboard & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Error al cargar configuración");
        return;
      }
      setDashboard(data);
      setForm(toForm(data.settings));
      setError(null);
    } catch {
      setError("Error de red");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function saveSection(patch: Partial<FormState>) {
    if (!form) return;
    setSaving(true);
    setMessage(null);
    try {
      const merged = { ...form, ...patch };
      const res = await fetch("/api/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api: {
            apiUrl: merged.apiUrl,
            wsUrl: merged.wsUrl,
            minLauncherVersion: merged.minLauncherVersion,
            latestLauncherVersion: merged.latestLauncherVersion,
          },
          oauth: {
            mode: merged.oauthMode,
            clientId: merged.clientId,
            redirectUri: merged.redirectUri,
          },
          security: {
            maintenanceMode: merged.maintenanceMode,
            maintenanceMessage: merged.maintenanceMessage,
            forceUpdate: merged.forceUpdate,
            verifyHwid: merged.verifyHwid,
            anticheatEnabled: merged.anticheatEnabled,
            launcherAuthEnforced: merged.launcherAuthEnforced,
          },
          features: {
            experimentsEnabled: merged.experimentsEnabled,
            notificationsEnabled: merged.notificationsEnabled,
            chatEnabled: merged.chatEnabled,
            integrationsEnabled: merged.integrationsEnabled,
          },
          branding: {
            serverName: merged.serverName,
            supportUrl: merged.supportUrl,
            launcherDownloadUrl: merged.launcherDownloadUrl,
          },
        }),
      });
      const data = (await res.json()) as { success?: boolean; settings?: SystemSettingsPublic; error?: string };
      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar");
        return;
      }
      if (data.settings) {
        setForm(toForm(data.settings));
      }
      setMessage("Configuración guardada");
      void refresh();
    } finally {
      setSaving(false);
    }
  }

  async function regenerateSecret() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "regenerate-oauth-secret" }),
      });
      const data = (await res.json()) as { settings?: SystemSettingsPublic };
      if (data.settings) setForm(toForm(data.settings));
      setMessage("Secret OAuth regenerado");
      void refresh();
    } finally {
      setSaving(false);
    }
  }

  async function testDb() {
    const res = await fetch("/api/settings?scope=db-test", { credentials: "include" });
    const data = (await res.json()) as { ok?: boolean; message?: string };
    setDbTest(data.ok ? `✓ ${data.message}` : `✗ ${data.message}`);
  }

  async function backupDb() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "db-backup" }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      setMessage(data.message ?? (data.ok ? "Backup completado" : "Backup falló"));
    } finally {
      setSaving(false);
    }
  }

  if (loading || !form || !dashboard) {
    return (
      <>
        <Header title="Configuración" description="API, auth y seguridad" />
        <PageContent>
          <p className="text-sm text-[var(--color-muted)]">Cargando…</p>
        </PageContent>
      </>
    );
  }

  const { overview, links } = dashboard;

  return (
    <>
      <Header title="Configuración" description="API, auth y seguridad" />

      <PageContent>
        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
        {message && <p className="mb-4 text-sm text-emerald-400">{message}</p>}

        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="BD" value={`${overview.dbSizeKb} KB`} icon={Database} />
          <StatCard title="Integraciones" value={overview.integrationsActive} icon={Link2} />
          <StatCard title="Experimentos" value={overview.experimentsRunning} icon={Zap} />
          <StatCard
            title="Mantenimiento"
            value={overview.maintenanceActive ? "ON" : "OFF"}
            icon={Server}
          />
        </div>

        <Tabs
          tabs={[
            { id: "api", label: "API" },
            { id: "oauth", label: "OAuth" },
            { id: "security", label: "Seguridad" },
            { id: "database", label: "Base de datos" },
            { id: "ecosystem", label: "Ecosistema" },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === "api" && (
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>API / WebSocket</CardTitle>
                <CardDescription>Endpoints que el launcher consulta</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="URL del API"
                  value={form.apiUrl}
                  onChange={(e) => setForm((f) => (f ? { ...f, apiUrl: e.target.value } : f))}
                />
                <Input
                  label="WebSocket"
                  value={form.wsUrl}
                  onChange={(e) => setForm((f) => (f ? { ...f, wsUrl: e.target.value } : f))}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Versión mínima"
                    value={form.minLauncherVersion}
                    onChange={(e) => setForm((f) => (f ? { ...f, minLauncherVersion: e.target.value } : f))}
                  />
                  <Input
                    label="Última versión"
                    value={form.latestLauncherVersion}
                    onChange={(e) => setForm((f) => (f ? { ...f, latestLauncherVersion: e.target.value } : f))}
                  />
                </div>
                <Button onClick={() => void saveSection({})} disabled={saving}>
                  <Save className="mr-1.5 h-3.5 w-3.5" /> Guardar
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Branding</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Nombre del servidor"
                  value={form.serverName}
                  onChange={(e) => setForm((f) => (f ? { ...f, serverName: e.target.value } : f))}
                />
                <Input
                  label="URL de soporte"
                  value={form.supportUrl}
                  onChange={(e) => setForm((f) => (f ? { ...f, supportUrl: e.target.value } : f))}
                />
                <Input
                  label="Descarga del launcher (.exe)"
                  value={form.launcherDownloadUrl}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, launcherDownloadUrl: e.target.value } : f))
                  }
                  placeholder="https://tu-usuario.itch.io/craftlauncher"
                />
                <Button variant="outline" onClick={() => void saveSection({})} disabled={saving}>
                  Guardar branding
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "oauth" && (
          <Card className="mt-4 max-w-xl">
            <CardHeader>
              <CardTitle>Microsoft OAuth</CardTitle>
              <CardDescription>
                Secret: {dashboard.settings.oauth.clientSecretMasked || "no configurado"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Client ID"
                value={form.clientId}
                onChange={(e) => setForm((f) => (f ? { ...f, clientId: e.target.value } : f))}
              />
              <Input
                label="Redirect URI"
                value={form.redirectUri}
                onChange={(e) => setForm((f) => (f ? { ...f, redirectUri: e.target.value } : f))}
              />
              <Select
                label="Modo"
                value={form.oauthMode}
                options={[
                  { value: "microsoft", label: "Microsoft (Premium)" },
                  { value: "offline", label: "Offline" },
                ]}
                onChange={(e) => setForm((f) => (f ? { ...f, oauthMode: e.target.value } : f))}
              />
              <div className="flex gap-2">
                <Button onClick={() => void saveSection({})} disabled={saving}>
                  Guardar
                </Button>
                <Button variant="outline" onClick={() => void regenerateSecret()} disabled={saving}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Regenerar secret
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {tab === "security" && (
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Seguridad global</CardTitle>
                <CardDescription>Conectado a Live Ops, automatización e integraciones</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Toggle
                  label="Modo mantenimiento"
                  checked={form.maintenanceMode}
                  onChange={(v) => {
                    setForm((f) => (f ? { ...f, maintenanceMode: v } : f));
                    void saveSection({ maintenanceMode: v });
                  }}
                />
                <Textarea
                  label="Mensaje de mantenimiento"
                  rows={2}
                  value={form.maintenanceMessage}
                  onChange={(e) => setForm((f) => (f ? { ...f, maintenanceMessage: e.target.value } : f))}
                />
                <Toggle
                  label="Avisar actualización (sin bloquear)"
                  checked={form.forceUpdate}
                  onChange={(v) => {
                    setForm((f) => (f ? { ...f, forceUpdate: v } : f));
                    void saveSection({ forceUpdate: v });
                  }}
                />
                <Toggle
                  label="Verificar HWID"
                  checked={form.verifyHwid}
                  onChange={(v) => {
                    setForm((f) => (f ? { ...f, verifyHwid: v } : f));
                    void saveSection({ verifyHwid: v });
                  }}
                />
                <Toggle
                  label="Anti-cheat"
                  checked={form.anticheatEnabled}
                  onChange={(v) => {
                    setForm((f) => (f ? { ...f, anticheatEnabled: v } : f));
                    void saveSection({ anticheatEnabled: v });
                  }}
                />
                <Toggle
                  label="Auth launcher obligatorio"
                  checked={form.launcherAuthEnforced}
                  onChange={(v) => {
                    setForm((f) => (f ? { ...f, launcherAuthEnforced: v } : f));
                    void saveSection({ launcherAuthEnforced: v });
                  }}
                />
                <Button onClick={() => void saveSection({})} disabled={saving}>
                  Guardar mensaje
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Features del ecosistema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Toggle
                  label="Experimentos A/B"
                  checked={form.experimentsEnabled}
                  onChange={(v) => {
                    setForm((f) => (f ? { ...f, experimentsEnabled: v } : f));
                    void saveSection({ experimentsEnabled: v });
                  }}
                />
                <Toggle
                  label="Notificaciones push"
                  checked={form.notificationsEnabled}
                  onChange={(v) => {
                    setForm((f) => (f ? { ...f, notificationsEnabled: v } : f));
                    void saveSection({ notificationsEnabled: v });
                  }}
                />
                <Toggle
                  label="Chat / moderación"
                  checked={form.chatEnabled}
                  onChange={(v) => {
                    setForm((f) => (f ? { ...f, chatEnabled: v } : f));
                    void saveSection({ chatEnabled: v });
                  }}
                />
                <Toggle
                  label="Integraciones webhook"
                  checked={form.integrationsEnabled}
                  onChange={(v) => {
                    setForm((f) => (f ? { ...f, integrationsEnabled: v } : f));
                    void saveSection({ integrationsEnabled: v });
                  }}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "database" && (
          <Card className="mt-4 max-w-xl">
            <CardHeader>
              <CardTitle>Base de datos</CardTitle>
              <CardDescription>SQLite interna del proyecto</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input label="Tipo" value={overview.dbType} disabled />
              <Input label="Ruta" value={overview.dbPath} disabled />
              <p className="text-xs text-[var(--color-muted)]">
                Tamaño: {overview.dbSizeKb} KB · Auth env:{" "}
                {overview.envAuthEnforced ? "forzado" : "relajado"}
              </p>
              {dbTest && <p className="text-sm text-[var(--color-text-soft)]">{dbTest}</p>}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => void testDb()}>
                  Test
                </Button>
                <Button variant="outline" size="sm" onClick={() => void backupDb()} disabled={saving}>
                  Backup
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {tab === "ecosystem" && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-[var(--color-text-soft)]">
              Módulos conectados a esta configuración:
            </p>
            {links.map((link) => (
              <a
                key={link.id}
                href={link.href}
                className={`flex items-center justify-between gap-4 rounded-xl border border-[var(--color-border-subtle)] p-4 transition hover:border-[var(--color-accent-muted)]`}
              >
                <div>
                  <p className="text-sm text-[var(--color-text)]">{link.label}</p>
                  <p className="text-xs text-[var(--color-text-soft)]">{link.description}</p>
                </div>
                <Badge className={badgeDefault}>
                  <Shield className="mr-1 inline h-3 w-3" />
                  Conectado
                </Badge>
              </a>
            ))}
          </div>
        )}
      </PageContent>
    </>
  );
}
