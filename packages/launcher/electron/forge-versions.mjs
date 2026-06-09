/** 5 versiones Forge más usadas en modpacks */
export const FORGE_VERSIONS = [
  { id: "1.21.1", label: "1.21.1 Forge", mcVersion: "1.21.1", forgeVersion: "52.1.0" },
  { id: "1.20.1", label: "1.20.1 Forge", mcVersion: "1.20.1", forgeVersion: "47.3.12" },
  { id: "1.19.2", label: "1.19.2 Forge", mcVersion: "1.19.2", forgeVersion: "43.4.0" },
  { id: "1.18.2", label: "1.18.2 Forge", mcVersion: "1.18.2", forgeVersion: "40.2.21" },
  { id: "1.16.5", label: "1.16.5 Forge", mcVersion: "1.16.5", forgeVersion: "36.2.39" },
  { id: "1.12.2", label: "1.12.2 Forge", mcVersion: "1.12.2", forgeVersion: "14.23.5.2860" },
];

export function resolveForgeVersion(versionId, forgeVersionOverride) {
  const normalized = String(versionId ?? "").trim();
  const found = FORGE_VERSIONS.find((v) => v.id === normalized || v.mcVersion === normalized);
  if (found) {
    if (forgeVersionOverride) return { ...found, forgeVersion: forgeVersionOverride };
    return found;
  }
  return {
    id: normalized || "1.20.1",
    label: `${normalized || "1.20.1"} Forge`,
    mcVersion: normalized || "1.20.1",
    forgeVersion: forgeVersionOverride ?? "52.1.0",
  };
}
