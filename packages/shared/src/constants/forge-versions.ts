export type ForgeVersion = {
  id: string;
  label: string;
  mcVersion: string;
  forgeVersion: string;
};

/** 5 versiones Forge más usadas — misma lista en admin y launcher */
export const FORGE_VERSIONS: ForgeVersion[] = [
  { id: "1.21.1", label: "1.21.1 Forge", mcVersion: "1.21.1", forgeVersion: "52.1.0" },
  { id: "1.20.1", label: "1.20.1 Forge", mcVersion: "1.20.1", forgeVersion: "47.3.12" },
  { id: "1.19.2", label: "1.19.2 Forge", mcVersion: "1.19.2", forgeVersion: "43.4.0" },
  { id: "1.18.2", label: "1.18.2 Forge", mcVersion: "1.18.2", forgeVersion: "40.2.21" },
  { id: "1.16.5", label: "1.16.5 Forge", mcVersion: "1.16.5", forgeVersion: "36.2.39" },
  { id: "1.12.2", label: "1.12.2 Forge", mcVersion: "1.12.2", forgeVersion: "14.23.5.2860" },
];

export function resolveForgeVersion(versionId: string, forgeVersionOverride?: string): ForgeVersion {
  const normalized = versionId.trim();
  const found = FORGE_VERSIONS.find((v) => v.id === normalized || v.mcVersion === normalized);
  if (found) {
    if (forgeVersionOverride) return { ...found, forgeVersion: forgeVersionOverride };
    return found;
  }
  return {
    id: normalized,
    label: `${normalized} Forge`,
    mcVersion: normalized,
    forgeVersion: forgeVersionOverride ?? "52.1.0",
  };
}

export function pickForgeVersionFromLayout(
  layout: { screens: { elements: { type: string; value?: unknown; label?: string }[] }[] },
  fallback = "1.20.1"
): string {
  for (const screen of layout.screens) {
    const installed = screen.elements.find((e) => e.type === "installed-version-selector");
    if (installed?.value) return resolveForgeVersion(String(installed.value)).id;
  }
  for (const screen of layout.screens) {
    const selector = screen.elements.find((e) => e.type === "version-selector");
    if (selector?.value) return resolveForgeVersion(String(selector.value)).id;
  }
  for (const screen of layout.screens) {
    const installed = screen.elements.find((e) => e.type === "installed-version-selector");
    if (installed) return resolveForgeVersion(String(installed.label ?? fallback)).id;
  }
  for (const screen of layout.screens) {
    const selector = screen.elements.find((e) => e.type === "version-selector");
    if (selector) return resolveForgeVersion(String(selector.label ?? fallback)).id;
  }
  return resolveForgeVersion(fallback).id;
}
