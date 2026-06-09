"use client";

import type { HubElement } from "@craftlauncher/shared";
import { useEffect } from "react";
import { useLauncherDataStore } from "@/lib/launcher-data-store";
import { isDesktopLauncher } from "@/lib/electron-api";
import { InstanceAvatarList } from "./InstanceAvatarList";

function useInstancesBootstrap() {
  useEffect(() => {
    if (!isDesktopLauncher()) return;
    void useLauncherDataStore.getState().bootstrap();
  }, []);
}

/** Grid de avatares de todos los perfiles — clic para activar. */
export function InstanceAvatarGridHub({ element }: { element: HubElement }) {
  const instances = useLauncherDataStore((s) => s.instances);
  const active = useLauncherDataStore((s) => s.activeInstance);
  const loading = useLauncherDataStore((s) => s.loading);
  useInstancesBootstrap();

  if (!isDesktopLauncher()) {
    return <p className="ih-muted ih-instance-avatar-empty">Solo en el launcher de escritorio.</p>;
  }

  if (instances.length === 0) {
    return <p className="ih-muted ih-instance-avatar-empty">No hay perfiles.</p>;
  }

  return (
    <InstanceAvatarList
      element={element}
      instances={instances}
      activeId={active?.id}
      loading={loading}
      onSelect={(id) => void useLauncherDataStore.getState().selectInstance(id)}
    />
  );
}
