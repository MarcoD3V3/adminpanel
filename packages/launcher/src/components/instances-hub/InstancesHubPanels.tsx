"use client";

import { useEffect } from "react";
import { FORGE_VERSIONS, resolveInstanceIconColor, type PillSelectStyleId } from "@craftlauncher/shared";
import { useLauncherDataStore } from "@/lib/launcher-data-store";
import { isDesktopLauncher } from "@/lib/electron-api";
import { HubPillSelect } from "@/components/hub/HubPillSelect";

function useInstancesBootstrap() {
  useEffect(() => {
    if (!isDesktopLauncher()) return;
    void useLauncherDataStore.getState().bootstrap();
  }, []);
}

/** Campo nombre — carpeta legible o vacío = usa la versión. */
export function InstanceNameInputHub() {
  const name = useLauncherDataStore((s) => s.instanceDraftName);
  const loading = useLauncherDataStore((s) => s.loading);
  useInstancesBootstrap();

  return (
    <input
      className="ih-input"
      placeholder="Nombre del perfil (opcional)"
      value={name}
      disabled={loading || !isDesktopLauncher()}
      onChange={(e) => useLauncherDataStore.getState().setInstanceDraftName(e.target.value)}
    />
  );
}

/** Selector de versión Forge para el nuevo perfil. */
export function InstanceVersionSelectHub({ styleVariant = 1 }: { styleVariant?: PillSelectStyleId | number }) {
  const version = useLauncherDataStore((s) => s.instanceDraftVersion);
  const loading = useLauncherDataStore((s) => s.loading);
  useInstancesBootstrap();

  const options = FORGE_VERSIONS.map((v) => ({ value: v.mcVersion, label: v.label }));

  return (
    <HubPillSelect
      value={version}
      options={options}
      styleVariant={styleVariant}
      disabled={loading || !isDesktopLauncher()}
      onChange={(v) => useLauncherDataStore.getState().setInstanceDraftVersion(v)}
    />
  );
}

/** Botón crear perfil (usa borrador nombre + versión). */
export function InstanceCreateButtonHub({ label = "Crear perfil" }: { label?: string }) {
  const loading = useLauncherDataStore((s) => s.loading);
  useInstancesBootstrap();

  return (
    <button
      type="button"
      className="ih-btn"
      disabled={loading || !isDesktopLauncher()}
      onClick={() => void useLauncherDataStore.getState().submitInstanceDraft()}
    >
      {loading ? "Creando…" : label}
    </button>
  );
}

/** Formulario completo: nombre + versión + crear. */
export function InstanceCreateFormHub() {
  useInstancesBootstrap();

  return (
    <div className="ih-form">
      <p className="ih-form-title">Nuevo perfil</p>
      <p className="ih-form-hint">Carpeta aislada con mods y guardados propios. Sin nombre → usa la versión.</p>
      <InstanceNameInputHub />
      <InstanceVersionSelectHub />
      <InstanceCreateButtonHub />
    </div>
  );
}

/** Lista de perfiles con activar y eliminar. */
export function InstanceListHub() {
  const instances = useLauncherDataStore((s) => s.instances);
  const active = useLauncherDataStore((s) => s.activeInstance);
  const loading = useLauncherDataStore((s) => s.loading);
  useInstancesBootstrap();

  if (!isDesktopLauncher()) {
    return <p className="ih-muted">Perfiles solo en el launcher de escritorio.</p>;
  }

  return (
    <ul className="ih-instance-list">
      {instances.map((inst) => {
        const isActive = inst.id === active?.id;
        return (
          <li key={inst.id} className={`ih-instance${isActive ? " active" : ""}`}>
            <button
              type="button"
              className="ih-instance-main"
              disabled={loading}
              onClick={() => void useLauncherDataStore.getState().selectInstance(inst.id)}
            >
              <span className="ih-instance-dot" style={{ background: resolveInstanceIconColor(inst) }} />
              <span className="ih-instance-text">
                <strong>{inst.name}</strong>
                <small>
                  {inst.mcVersion} · {inst.id}
                </small>
              </span>
              {isActive && <span className="ih-badge">Activo</span>}
            </button>
            {instances.length > 1 && (
              <button
                type="button"
                className="ih-icon-danger"
                title="Eliminar"
                disabled={loading}
                onClick={() => void useLauncherDataStore.getState().deleteInstance(inst.id)}
              >
                ×
              </button>
            )}
          </li>
        );
      })}
      {instances.length === 0 && <li className="ih-muted">No hay perfiles. Crea uno arriba.</li>}
    </ul>
  );
}

/** Tarjeta del perfil activo. */
export function InstanceActiveCardHub() {
  const active = useLauncherDataStore((s) => s.activeInstance);
  const stats = useLauncherDataStore((s) => s.instanceStats);
  useInstancesBootstrap();

  if (!active) {
    return <p className="ih-muted">Ningún perfil activo.</p>;
  }

  return (
    <div className="ih-active-card">
      <span className="ih-instance-dot large" style={{ background: resolveInstanceIconColor(active) }} />
      <div>
        <p className="ih-active-label">Perfil activo</p>
        <p className="ih-active-name">{active.name}</p>
        <p className="ih-active-meta">
          Minecraft {active.mcVersion}
          {active.forgeVersion ? ` · Forge ${active.forgeVersion}` : ""}
        </p>
        <p className="ih-active-folder" title={active.id}>
          Carpeta: {active.id}
        </p>
        {stats && (
          <p className="ih-active-stats">
            {stats.modCount} mods · {stats.resourcePackCount} texturas
          </p>
        )}
      </div>
    </div>
  );
}
