/** Perfil de versión Minecraft para el admin, Hub Builder y el mod. */
export type MinecraftVersionProfile = {
  id: string;
  mcVersion: string;
  forgeVersion: string;
  label: string;
  enabled: boolean;
  javaRequired: string;
  /** true si existe un JAR del mod compilado para esta versión */
  modBuilt: boolean;
  ui: {
    menuDesignW: number;
    menuDesignH: number;
    menuFrameW: number;
    menuFrameH: number;
    loadingDesignW: number;
    loadingDesignH: number;
    defaultButtonW: number;
    defaultButtonH: number;
    compactButtonW: number;
    compactButtonH: number;
  };
};

export const DEFAULT_MC_UI = {
  menuDesignW: 480,
  menuDesignH: 270,
  menuFrameW: 1920,
  menuFrameH: 1080,
  loadingDesignW: 480,
  loadingDesignH: 270,
  defaultButtonW: 98,
  defaultButtonH: 11,
  compactButtonW: 48,
  compactButtonH: 11,
} as const;

/** Versiones soportadas por el launcher (Forge). modBuilt=true solo donde hay JAR compilado. */
export const MINECRAFT_VERSION_CATALOG: MinecraftVersionProfile[] = [
  {
    id: "1.21.1",
    mcVersion: "1.21.1",
    forgeVersion: "52.1.0",
    label: "1.21.1 Forge",
    enabled: false,
    javaRequired: "21",
    modBuilt: false,
    ui: { ...DEFAULT_MC_UI, defaultButtonW: 200, defaultButtonH: 20, compactButtonW: 98, compactButtonH: 20 },
  },
  {
    id: "1.20.1",
    mcVersion: "1.20.1",
    forgeVersion: "47.3.12",
    label: "1.20.1 Forge",
    enabled: false,
    javaRequired: "17",
    modBuilt: false,
    ui: { ...DEFAULT_MC_UI, defaultButtonW: 200, defaultButtonH: 20, compactButtonW: 98, compactButtonH: 20 },
  },
  {
    id: "1.19.2",
    mcVersion: "1.19.2",
    forgeVersion: "43.4.0",
    label: "1.19.2 Forge",
    enabled: false,
    javaRequired: "17",
    modBuilt: false,
    ui: { ...DEFAULT_MC_UI },
  },
  {
    id: "1.18.2",
    mcVersion: "1.18.2",
    forgeVersion: "40.2.21",
    label: "1.18.2 Forge",
    enabled: true,
    javaRequired: "17",
    modBuilt: false,
    ui: { ...DEFAULT_MC_UI },
  },
  {
    id: "1.16.5",
    mcVersion: "1.16.5",
    forgeVersion: "36.2.39",
    label: "1.16.5 Forge",
    enabled: true,
    javaRequired: "8",
    modBuilt: false,
    ui: { ...DEFAULT_MC_UI, defaultButtonW: 200, defaultButtonH: 20 },
  },
  {
    id: "1.12.2",
    mcVersion: "1.12.2",
    forgeVersion: "14.23.5.2860",
    label: "1.12.2 Forge",
    enabled: false,
    javaRequired: "8",
    modBuilt: false,
    ui: { ...DEFAULT_MC_UI, defaultButtonW: 200, defaultButtonH: 20 },
  },
];

export function resolveVersionProfile(mcVersion: string): MinecraftVersionProfile {
  const v = mcVersion.trim();
  return (
    MINECRAFT_VERSION_CATALOG.find((p) => p.id === v || p.mcVersion === v) ??
    MINECRAFT_VERSION_CATALOG.find((p) => p.enabled) ??
    MINECRAFT_VERSION_CATALOG.find((p) => p.mcVersion === "1.18.2")!
  );
}

export function mergeVersionRegistry(
  stored: Partial<MinecraftVersionProfile>[] | null | undefined
): MinecraftVersionProfile[] {
  const byId = new Map(MINECRAFT_VERSION_CATALOG.map((p) => [p.id, { ...p }]));
  for (const row of stored ?? []) {
    if (!row?.id) continue;
    const base = byId.get(row.id);
    if (!base) continue;
    byId.set(row.id, {
      ...base,
      enabled: row.enabled ?? base.enabled,
      label: row.label ?? base.label,
    });
  }
  return [...byId.values()];
}

export function enabledMinecraftVersions(registry: MinecraftVersionProfile[]): MinecraftVersionProfile[] {
  return registry.filter((v) => v.enabled);
}
