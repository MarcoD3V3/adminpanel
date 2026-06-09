"use client";

import type { HubElement } from "@craftlauncher/shared";
import { useEffect } from "react";
import { useLauncherDataStore } from "@/lib/launcher-data-store";
import { isDesktopLauncher } from "@/lib/electron-api";
import { InstanceAvatarSingle } from "./InstanceAvatarList";

function useInstancesBootstrap() {
  useEffect(() => {
    if (!isDesktopLauncher()) return;
    void useLauncherDataStore.getState().bootstrap();
  }, []);
}

/** Avatar circular del perfil activo. */
export function InstanceAvatarHub({ element }: { element: HubElement }) {
  const active = useLauncherDataStore((s) => s.activeInstance);
  useInstancesBootstrap();

  if (!isDesktopLauncher()) {
    return <p className="ih-muted ih-instance-avatar-empty">Solo en el launcher de escritorio.</p>;
  }

  return <InstanceAvatarSingle element={element} instance={active} />;
}
