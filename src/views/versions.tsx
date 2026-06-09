"use client";

import { useCallback, useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import type { MinecraftVersionProfile } from "@/lib/minecraft-versions";
import {
  cacheMinecraftVersions,
  fetchMinecraftVersions,
  readCachedMinecraftVersions,
} from "@/lib/minecraft-versions-client";
import { badgeDefault, tableHead, tableRow } from "@/lib/styles";
import { Save, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function VersionsPage() {
  const [versions, setVersions] = useState<MinecraftVersionProfile[]>(
    () => readCachedMinecraftVersions()?.versions ?? []
  );
  const [loading, setLoading] = useState(() => !readCachedMinecraftVersions());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!readCachedMinecraftVersions()) setLoading(true);
    try {
      const data = await fetchMinecraftVersions({
        onUpdate: (payload) => setVersions(payload.versions ?? []),
      });
      setVersions(data.versions ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/minecraft-versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versions: versions.map((v) => ({ id: v.id, enabled: v.enabled, label: v.label })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const next = (data.versions ?? versions) as MinecraftVersionProfile[];
        setVersions(next);
        cacheMinecraftVersions({
          schema: 1,
          versions: next,
          enabled: next.filter((v) => v.enabled),
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  const enabledCount = versions.filter((v) => v.enabled).length;

  return (
    <>
      <Header
        title="Versiones Minecraft"
        description="Controla qué versiones aparecen en el launcher y en el editor de interfaz in-game"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
            </Button>
            <Button size="sm" onClick={() => void save()} disabled={saving || loading}>
              <Save className="h-3.5 w-3.5" strokeWidth={1.5} />
              {saved ? "Guardado" : saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        }
      />

      <PageContent className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Catálogo Forge</CardTitle>
            <CardDescription>
              {enabledCount} activa(s) · Solo las versiones con mod <strong>Compilado</strong> instalan el JAR en
              el juego. Las demás arrancan Forge normal sin romper nada. Cada versión necesita su propio build:{" "}
              <code className="text-[10px]">npm run build:client-mod -- 1.18.2</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className={tableHead}>
                  <th className="px-6 pb-3 pt-2">Versión</th>
                  <th className="px-4 pb-3 pt-2">Forge</th>
                  <th className="px-4 pb-3 pt-2">Java</th>
                  <th className="px-4 pb-3 pt-2">Mod</th>
                  <th className="hidden px-4 pb-3 pt-2 md:table-cell">Canvas menú</th>
                  <th className="px-6 pb-3 pt-2">Activa</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id} className={`${tableRow} hover:bg-[var(--color-surface)]`}>
                    <td className="px-6 py-3 font-medium text-[var(--color-text)]">{v.label}</td>
                    <td className="px-4 py-3 font-mono text-[10px] text-[var(--color-text-soft)]">
                      {v.forgeVersion}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-soft)]">{v.javaRequired}</td>
                    <td className="px-4 py-3">
                      <Badge className={v.modBuilt ? badgeDefault : "bg-amber-500/15 text-amber-400"}>
                        {v.modBuilt ? "Compilado" : "Pendiente"}
                      </Badge>
                    </td>
                    <td className="hidden px-4 py-3 text-[var(--color-text-soft)] md:table-cell">
                      {v.ui.menuDesignW}×{v.ui.menuDesignH}
                    </td>
                    <td className="px-6 py-3">
                      <Toggle
                        compact
                        checked={v.enabled}
                        onChange={(checked) =>
                          setVersions((prev) =>
                            prev.map((ver) => (ver.id === v.id ? { ...ver, enabled: checked } : ver))
                          )
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Interfaz in-game</CardTitle>
            <CardDescription>
              Cada versión activa tiene su propio JSON de menú y pantalla de carga. Edítalos desde el Hub Builder.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link href="/hub-builder">
              <Button size="sm" variant="outline">
                Abrir Editor Hub → Minecraft
              </Button>
            </Link>
            <p className="w-full text-xs text-[var(--color-muted)]">
              Rutas: <code className="font-mono">data/game-ui/&#123;versión&#125;.json</code> y{" "}
              <code className="font-mono">data/loading-ui/&#123;versión&#125;.json</code>
            </p>
          </CardContent>
        </Card>
      </PageContent>
    </>
  );
}
