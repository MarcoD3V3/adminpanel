"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { mockBanners, mockFeatureFlags } from "@/lib/mock-data";
import { mockSeasonThemes } from "@/lib/feature-data";
import { badgeDefault, rowItem } from "@/lib/styles";
import { Plus } from "lucide-react";

export default function StudioPage() {
  const [tab, setTab] = useState("branding");
  const [flags, setFlags] = useState(mockFeatureFlags);
  const [banners, setBanners] = useState(mockBanners);
  const [accentColor, setAccentColor] = useState("#496f4f");
  const [launcherName, setLauncherName] = useState("CraftLauncher");
  const [darkMode, setDarkMode] = useState(true);
  const [animations, setAnimations] = useState(true);
  const [themes, setThemes] = useState(mockSeasonThemes);

  return (
    <>
      <Header
        title="Studio"
        description="Apariencia, contenido y features"
        actions={<Button size="sm" variant="outline">Publicar</Button>}
      />

      <PageContent>
        <Tabs
          tabs={[
            { id: "branding", label: "Branding" },
            { id: "seasons", label: "Temporadas" },
            { id: "content", label: "Contenido" },
            { id: "features", label: "Flags" },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === "branding" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Identidad visual</CardTitle>
                <CardDescription>Sincroniza con launchers conectados</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input label="Nombre" value={launcherName} onChange={(e) => setLauncherName(e.target.value)} />
                <div className="space-y-1.5">
                  <label className="text-xs text-[var(--color-text-soft)]">Color de acento</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="h-10 w-14 cursor-pointer rounded-lg border border-[var(--color-border)] bg-transparent"
                    />
                    <span className="font-mono text-xs text-[var(--color-muted)]">{accentColor}</span>
                  </div>
                </div>
                <Input label="Logo URL" placeholder="https://..." hint="PNG, máx 512×512" />
                <Input label="Fondo" placeholder="URL o CSS gradient" />
                <Toggle label="Modo oscuro forzado" checked={darkMode} onChange={setDarkMode} />
                <Toggle label="Animaciones" checked={animations} onChange={setAnimations} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Vista previa</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6">
                  <div className="mb-5 flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-sm text-white"
                      style={{ background: accentColor }}
                    >
                      {launcherName.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-lg font-light text-[var(--color-text)]">{launcherName}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="h-10 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)]" />
                    <div className="h-10 rounded-xl text-center text-sm leading-10 text-white/90" style={{ background: accentColor }}>
                      Jugar
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "seasons" && (
          <div className="space-y-3">
            <p className="text-xs text-[var(--color-text-soft)]">
              Temas dinámicos por temporada — se aplican automáticamente en el rango de fechas
            </p>
            {themes.map((theme) => (
              <div key={theme.id} className={`flex items-center justify-between gap-4 ${rowItem}`}>
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 shrink-0 rounded-xl border border-[var(--color-border-subtle)]"
                    style={{ background: theme.accentColor }}
                  />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm text-[var(--color-text)]">{theme.name}</p>
                      {theme.active && <Badge className={badgeDefault}>Activo</Badge>}
                    </div>
                    <p className="text-[11px] text-[var(--color-muted)]">
                      {theme.startDate} → {theme.endDate}
                      {theme.backgroundUrl && ` · ${theme.backgroundUrl}`}
                    </p>
                  </div>
                </div>
                <Toggle
                  compact
                  checked={theme.active}
                  onChange={(checked) =>
                    setThemes((prev) =>
                      prev.map((t) =>
                        t.id === theme.id
                          ? { ...t, active: checked }
                          : checked
                            ? { ...t, active: false }
                            : t
                      )
                    )
                  }
                />
              </div>
            ))}
          </div>
        )}

        {tab === "content" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> Banner</Button>
            </div>
            {banners.map((banner) => (
              <div key={banner.id} className={`flex items-center justify-between gap-4 ${rowItem}`}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm text-[var(--color-text)]">{banner.title}</p>
                    <Badge className={badgeDefault}>{banner.position}</Badge>
                  </div>
                  <p className="text-xs text-[var(--color-muted)]">{banner.subtitle}</p>
                </div>
                <Toggle
                  compact
                  checked={banner.active}
                  onChange={(checked) =>
                    setBanners((prev) => prev.map((b) => (b.id === banner.id ? { ...b, active: checked } : b)))
                  }
                />
              </div>
            ))}
          </div>
        )}

        {tab === "features" && (
          <div className="space-y-3">
            {flags.map((flag) => (
              <div key={flag.id} className={`flex items-start justify-between gap-4 ${rowItem}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm text-[var(--color-text)]">{flag.name}</p>
                    <code className="rounded bg-[var(--color-surface-hover)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
                      {flag.key}
                    </code>
                    <Badge className={badgeDefault}>{flag.audience}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-soft)]">{flag.description}</p>
                  <div className="mt-3 max-w-xs">
                    <div className="mb-1 flex justify-between text-[11px] text-[var(--color-muted)]">
                      <span>Rollout</span>
                      <span>{flag.rollout}%</span>
                    </div>
                    <ProgressBar value={flag.rollout} />
                  </div>
                </div>
                <Toggle
                  compact
                  checked={flag.enabled}
                  onChange={(checked) =>
                    setFlags((prev) => prev.map((f) => (f.id === flag.id ? { ...f, enabled: checked } : f)))
                  }
                />
              </div>
            ))}
          </div>
        )}
      </PageContent>
    </>
  );
}
