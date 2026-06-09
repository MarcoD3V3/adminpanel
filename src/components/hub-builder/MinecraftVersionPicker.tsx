"use client";

import { useEffect, useState } from "react";
import { Select } from "@/components/ui/Input";
import type { MinecraftVersionProfile } from "@/lib/minecraft-versions";
import {
  fetchMinecraftVersions,
  readCachedMinecraftVersions,
} from "@/lib/minecraft-versions-client";
import { useHubBuilderStore } from "@/lib/hub-builder-store";

export function MinecraftVersionPicker({ compact }: { compact?: boolean }) {
  const minecraftEditVersion = useHubBuilderStore((s) => s.minecraftEditVersion);
  const setMinecraftEditVersion = useHubBuilderStore((s) => s.setMinecraftEditVersion);
  const [versions, setVersions] = useState<MinecraftVersionProfile[]>(
    () => readCachedMinecraftVersions()?.enabled ?? []
  );

  useEffect(() => {
    let cancelled = false;
    const apply = (list: MinecraftVersionProfile[]) => {
      if (cancelled) return;
      setVersions(list);
      const current = useHubBuilderStore.getState().minecraftEditVersion;
      if (list.length && !list.some((v) => v.mcVersion === current)) {
        setMinecraftEditVersion(list[0].mcVersion);
      }
    };

    void fetchMinecraftVersions({
      onUpdate: (data) => apply(data.enabled?.length ? data.enabled : []),
    })
      .then((data) => apply(data.enabled?.length ? data.enabled : []))
      .catch(() => {
        if (!cancelled) setVersions((prev) => (prev.length ? prev : []));
      });

    return () => {
      cancelled = true;
    };
  }, [setMinecraftEditVersion]);

  if (versions.length === 0) return null;

  return (
    <Select
      compact={compact}
      label={compact ? undefined : "Versión Minecraft"}
      value={minecraftEditVersion}
      onChange={(e) => setMinecraftEditVersion(e.target.value)}
      options={versions.map((v) => ({
        value: v.mcVersion,
        label: `${v.label}${v.modBuilt ? "" : " (sin mod)"}`,
      }))}
    />
  );
}
