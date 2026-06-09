"use client";

import { useEffect, useMemo } from "react";
import { FORGE_VERSIONS, resolveForgeVersion } from "@craftlauncher/shared";
import { useLauncherDataStore } from "@/lib/launcher-data-store";
import { isDesktopLauncher } from "@/lib/electron-api";
import type { PillSelectStyleId } from "@craftlauncher/shared";
import { HubPillSelect } from "@/components/hub/HubPillSelect";

function useInstancesBootstrap() {
  useEffect(() => {
    if (!isDesktopLauncher()) return;
    void useLauncherDataStore.getState().bootstrap();
  }, []);
}

/** Pill como version-selector: elige perfil / instancia activa. */
export function InstanceSelectorHub({
  value,
  onChange,
  styleVariant,
  backgroundColor,
}: {
  value?: string;
  onChange?: (instanceId: string) => void;
  styleVariant?: PillSelectStyleId | number;
  backgroundColor?: string;
}) {
  const instances = useLauncherDataStore((s) => s.instances);
  const active = useLauncherDataStore((s) => s.activeInstance);
  const loading = useLauncherDataStore((s) => s.loading);
  useInstancesBootstrap();

  const options = useMemo(
    () =>
      instances.map((inst) => ({
        value: inst.id,
        label: `${inst.name} · ${inst.mcVersion}`,
      })),
    [instances]
  );

  const current = value && instances.some((i) => i.id === value) ? value : active?.id ?? "";

  if (!isDesktopLauncher()) {
    return <HubPillSelect value="" options={[]} disabled placeholder="Solo escritorio" onChange={() => {}} />;
  }

  return (
    <HubPillSelect
      value={current}
      options={options}
      disabled={loading || options.length === 0}
      placeholder="Sin perfiles"
      styleVariant={styleVariant}
      backgroundColor={backgroundColor}
      onChange={(id) => onChange?.(id)}
    />
  );
}

/** Pill: versiones detectadas en game/versions del perfil activo. */
export function InstalledVersionSelectorHub({
  value,
  onChange,
  styleVariant,
}: {
  value?: string;
  onChange?: (versionId: string) => void;
  styleVariant?: PillSelectStyleId | number;
}) {
  const installed = useLauncherDataStore((s) => s.installedGameVersions);
  const active = useLauncherDataStore((s) => s.activeInstance);
  const loading = useLauncherDataStore((s) => s.loading);
  useInstancesBootstrap();

  useEffect(() => {
    if (!isDesktopLauncher()) return;
    void useLauncherDataStore.getState().refreshInstalledVersions();
  }, [active?.id]);

  const options = useMemo(() => {
    if (installed.length > 0) {
      return installed.map((v) => ({ value: v.id, label: v.label }));
    }
    return FORGE_VERSIONS.map((v) => ({ value: v.id, label: v.label }));
  }, [installed]);

  const fallback = options[0]?.value ?? "1.20.1";
  const resolved = value && options.some((o) => o.value === value) ? value : fallback;
  const current = resolveForgeVersion(resolved).id;

  if (!isDesktopLauncher()) {
    return (
      <HubPillSelect
        value={current}
        options={FORGE_VERSIONS.map((v) => ({ value: v.id, label: v.label }))}
        disabled
        onChange={() => {}}
      />
    );
  }

  return (
    <HubPillSelect
      value={current}
      options={options}
      disabled={loading || !active}
      placeholder={active ? "Sin versiones" : "Elige un perfil"}
      styleVariant={styleVariant}
      onChange={(id) => onChange?.(id)}
    />
  );
}
