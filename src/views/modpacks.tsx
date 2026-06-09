"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { FilterPills } from "@/components/ui/FilterPills";
import { StatCard } from "@/components/ui/StatCard";
import { CurseForgePicker } from "@/components/modpacks/CurseForgePicker";
import {
  defaultDetailsFromHit,
  enrichAllModpacks,
  formatDownloads,
  modpackFromCurseForge,
  type CurseForgeBrowseKind,
  type CurseForgeSearchHit,
} from "@/lib/curseforge-admin";
import { formatRelativeTime } from "@/lib/utils";
import { badgeDanger, badgeDefault, rowItem } from "@/lib/styles";
import { Download, HardDrive, Package, Plus, Puzzle, RefreshCw, Trash2 } from "lucide-react";
import type { Modpack } from "@/types/features";

const loaderFilters = [
  { id: "all", label: "Todos" },
  { id: "modpack", label: "Modpacks" },
  { id: "mod", label: "Mods" },
  { id: "forge", label: "Forge" },
  { id: "fabric", label: "Fabric" },
  { id: "quilt", label: "Quilt" },
  { id: "vanilla", label: "Vanilla" },
];

function isModEntry(p: Modpack) {
  return p.catalogKind === "mod";
}

export default function ModpacksPage() {
  const [entries, setEntries] = useState<Modpack[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Modpack | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [featuredTabLabel, setFeaturedTabLabel] = useState<string>("Eventos");

  const load = useCallback(async (syncCf = false) => {
    setLoading(true);
    try {
      const res = await fetch("/api/modpacks");
      const d = (await res.json()) as { modpacks?: Modpack[] };
      let list = Array.isArray(d.modpacks) ? d.modpacks : [];
      if (syncCf && list.length) {
        setSyncing(true);
        list = await enrichAllModpacks(list);
        await fetch("/api/modpacks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modpacks: list }),
        });
      }
      setEntries(list);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    void fetch("/api/catalog-settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { settings?: { featuredTabLabel?: string } }) => {
        const label = d.settings?.featuredTabLabel?.trim();
        if (label) setFeaturedTabLabel(label);
      })
      .catch(() => undefined);
  }, []);

  const saveFeaturedLabel = async (label: string) => {
    setFeaturedTabLabel(label);
    await fetch("/api/catalog-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: { featuredTabLabel: label } }),
    }).catch(() => undefined);
  };

  const persist = async (next: Modpack[]) => {
    setEntries(next);
    await fetch("/api/modpacks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modpacks: next }),
    });
  };

  const filtered = useMemo(() => {
    if (filter === "mod") return entries.filter(isModEntry);
    if (filter === "modpack") return entries.filter((p) => !isModEntry(p));
    if (filter === "all") return entries;
    return entries.filter((m) => m.loader === filter);
  }, [entries, filter]);

  const modpacksOnly = entries.filter((p) => !isModEntry(p));
  const modsOnly = entries.filter(isModEntry);
  const totalDownloads = entries.reduce((s, m) => s + m.downloads, 0);
  const totalSizeMb = entries.reduce((s, m) => s + m.sizeMb, 0);
  const enabledCount = entries.filter((m) => m.enabled).length;
  const existingIds = entries.map((m) => m.curseForgeId).filter((id): id is number => id != null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3500);
  };

  const handleAddFromList = (hit: CurseForgeSearchHit, kind: CurseForgeBrowseKind) => {
    const catalogKind = kind === "mods" ? "mod" : "modpack";
    const entry = modpackFromCurseForge(hit, defaultDetailsFromHit(), { catalogKind });
    if (entries.some((e) => e.curseForgeId === entry.curseForgeId)) {
      showToast("Ya está en el catálogo.");
      return;
    }
    void persist([entry, ...entries]);
    showToast(
      `«${entry.name}» añadido al catálogo (sin descargar). Usa Sincronizar CF para versión/tamaño.`
    );
  };

  const removeEntry = async (id: string) => {
    const next = entries.filter((m) => m.id !== id);
    await persist(next);
    if (selected?.id === id) setSelected(null);
  };

  return (
    <>
      <Header
        title="Modpacks"
        description="Añade mods y modpacks al catálogo — sin descargar archivos desde el admin"
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={syncing || loading || !entries.length}
              onClick={() => void load(true)}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} strokeWidth={1.5} />
              {syncing ? "Sincronizando…" : "Sincronizar CF"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> Añadir
            </Button>
          </div>
        }
      />

      <PageContent>
        {toast && (
          <p className="rounded-lg border border-[var(--color-accent-muted)] bg-[var(--color-accent-soft)] px-3 py-2 text-[11px] text-[var(--color-accent)]">
            {toast}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-4">
          <StatCard title="Activos" value={enabledCount} icon={Package} />
          <StatCard
            title="Descargas (CF)"
            value={formatDownloads(totalDownloads)}
            icon={Download}
          />
          <StatCard
            title="Tamaño instalable"
            value={totalSizeMb >= 1024 ? `${(totalSizeMb / 1024).toFixed(1)} GB` : `${totalSizeMb} MB`}
            icon={HardDrive}
          />
          <StatCard title="Pestaña launcher" value={featuredTabLabel} icon={Package} />
        </div>

        <p className="text-[11px] text-[var(--color-muted)]">
          {modpacksOnly.length} modpacks · {modsOnly.length} mods curados
          {loading ? " · cargando…" : ""}
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Launcher</CardTitle>
            <CardDescription>Configura cómo se ve la pestaña de destacados dentro del launcher.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <label className="text-xs font-medium text-[var(--color-text-soft)]">Nombre de la pestaña</label>
              <input
                className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent-muted)]"
                value={featuredTabLabel}
                onChange={(e) => setFeaturedTabLabel(e.target.value)}
                onBlur={() => void saveFeaturedLabel(featuredTabLabel)}
                maxLength={24}
                placeholder="Eventos"
              />
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                Se aplica al reiniciar/recargar el launcher.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => void saveFeaturedLabel(featuredTabLabel)}>
              Guardar
            </Button>
          </CardContent>
        </Card>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Añadir desde CurseForge</CardTitle>
              <CardDescription>
                Se muestra la lista al abrir. Elige con el botón <strong>Añadir</strong> — solo guarda el ID en
                el catálogo. Nada se descarga aquí.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CurseForgePicker existingIds={existingIds} onAdd={handleAddFromList} />
            </CardContent>
          </Card>
        )}

        <FilterPills options={loaderFilters} active={filter} onChange={setFilter} />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-2 lg:col-span-2">
            {filtered.length === 0 && !loading && (
              <p className="text-sm text-[var(--color-muted)]">
                No hay entradas. Pulsa <strong>+ Añadir</strong> y elige en CurseForge.
              </p>
            )}
            {filtered.map((pack) => (
              <div
                key={pack.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelected(pack)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(pack);
                  }
                }}
                className={`w-full cursor-pointer text-left ${rowItem} ${selected?.id === pack.id ? "border-[var(--color-accent-muted)] bg-[var(--color-accent-soft)]/30" : ""}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {isModEntry(pack) ? (
                        <Puzzle className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                      ) : (
                        <Package className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                      )}
                      <p className="text-sm text-[var(--color-text)]">{pack.name}</p>
                      <Badge className={badgeDefault}>{pack.mcVersion}</Badge>
                      <Badge className={badgeDefault}>{pack.loader}</Badge>
                      {isModEntry(pack) && <Badge className={badgeDefault}>Mod</Badge>}
                      {pack.premiumOnly && <Badge className={badgeDefault}>Premium</Badge>}
                      {!pack.enabled && <Badge className={badgeDanger}>Desactivado</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-[var(--color-text-soft)]">{pack.description}</p>
                    <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                      {formatDownloads(pack.downloads)} descargas · {pack.sizeMb} MB · {pack.author}
                      {pack.curseForgeId ? ` · CF ${pack.curseForgeId}` : ""}
                    </p>
                  </div>
                  <div
                    className="flex shrink-0 items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    role="presentation"
                  >
                    <Toggle
                      compact
                      checked={pack.enabled}
                      onChange={(checked) => {
                        const next = entries.map((m) => (m.id === pack.id ? { ...m, enabled: checked } : m));
                        void persist(next);
                        if (selected?.id === pack.id) setSelected({ ...pack, enabled: checked });
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {selected && (
            <Card>
              <CardHeader>
                <CardTitle>{selected.name}</CardTitle>
                <CardDescription>
                  {isModEntry(selected) ? "Mod curado" : "Modpack"} · actualizado{" "}
                  {formatRelativeTime(selected.updatedAt)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-[var(--color-text-soft)]">{selected.description}</p>
                {!isModEntry(selected) && (
                  <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-hover)] p-3">
                    <p className="text-[11px] font-medium text-[var(--color-text-soft)]">Instancia al instalar</p>
                    <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">
                      Cuando el usuario pulse <strong>Instalar</strong>, se crea una instancia con este nombre.
                    </p>
                    <input
                      className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent-muted)]"
                      value={(selected as Modpack & { instanceName?: string }).instanceName ?? selected.name}
                      onChange={(e) => {
                        const value = e.target.value;
                        const next = entries.map((m) =>
                          m.id === selected.id ? ({ ...(m as Modpack & { instanceName?: string }), instanceName: value } as Modpack) : m
                        );
                        void persist(next);
                        setSelected({ ...(selected as Modpack & { instanceName?: string }), instanceName: value } as Modpack);
                      }}
                      placeholder={selected.name}
                      maxLength={48}
                    />
                  </div>
                )}
                <div className="space-y-1.5 text-xs text-[var(--color-muted)]">
                  <p>
                    {selected.mcVersion} · {selected.loader}
                  </p>
                  <p>{formatDownloads(selected.downloads)} descargas en CurseForge</p>
                  <p>{selected.sizeMb} MB (último archivo)</p>
                  <p>{selected.author}</p>
                </div>
                {selected.curseForgeId ? (
                  <p className="text-[11px] text-[var(--color-accent)]">
                    CurseForge {selected.curseForgeId} —{" "}
                    {isModEntry(selected)
                      ? "instalable en el launcher (pestaña Mods, arriba del buscador)."
                      : "instalable en Destacados / Modpacks."}
                  </p>
                ) : (
                  <p className="text-[11px] text-[var(--color-danger)]">Sin ID CurseForge.</p>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-[var(--color-danger)]"
                  onClick={() => void removeEntry(selected.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Quitar del catálogo
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </PageContent>
    </>
  );
}
