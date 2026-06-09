import { FORGE_VERSIONS } from "@craftlauncher/shared";

/** Texto dinámico del menú principal de Minecraft (Forge, logo, avisos…). */
export type GameMenuBinding =
  | "forge_version"
  | "minecraft_version"
  | "mcp_version"
  | "mods_loaded"
  | "forge_update"
  | "minecraft_logo"
  | "java_edition";

export const GAME_MENU_BINDINGS: { value: GameMenuBinding; label: string; hint: string }[] = [
  { value: "minecraft_logo", label: "Logo MINECRAFT", hint: "Título grande centrado" },
  { value: "java_edition", label: "Java Edition", hint: "Subtítulo bajo el logo" },
  { value: "forge_version", label: "Versión Forge", hint: "Ej. Forge 40.2.21" },
  { value: "minecraft_version", label: "Versión Minecraft", hint: "Ej. Minecraft 1.18.2" },
  { value: "mcp_version", label: "MCP", hint: "Identificador MCP de Forge" },
  { value: "mods_loaded", label: "Mods cargados", hint: "Contador de mods activos" },
  { value: "forge_update", label: "Aviso actualización Forge", hint: "Solo si hay versión nueva" },
];

const MCP_BY_MC: Record<string, string> = {
  "1.16.5": "20210115.111550",
  "1.18.2": "20220404.173914",
  "1.19.2": "20220608.095529",
  "1.20.1": "20230612.114412",
  "1.21.1": "20240808.132146",
};

const FORGE_UPDATE_HINT: Record<string, string> = {
  "1.16.5": "36.2.42",
  "1.18.2": "40.3.0",
  "1.19.2": "43.3.0",
  "1.20.1": "47.3.0",
};

function forgeVersionFor(mcVersion: string): string {
  const hit = FORGE_VERSIONS.find((v) => v.mcVersion === mcVersion);
  return hit?.forgeVersion ?? "?.?.?";
}

/** Texto de vista previa en el editor según la versión MC seleccionada. */
export function resolveGameMenuBindingPreview(binding: GameMenuBinding, mcVersion: string): string {
  switch (binding) {
    case "minecraft_logo":
      return "MINECRAFT";
    case "java_edition":
      return "Java Edition";
    case "forge_version":
      return `Forge ${forgeVersionFor(mcVersion)}`;
    case "minecraft_version":
      return `Minecraft ${mcVersion}`;
    case "mcp_version":
      return `MCP ${MCP_BY_MC[mcVersion] ?? "—"}`;
    case "mods_loaded":
      return "3 mods loaded";
    case "forge_update": {
      const next = FORGE_UPDATE_HINT[mcVersion];
      return next ? `New Forge version available: ${next}` : "";
    }
    default:
      return "";
  }
}

export function isGameMenuLogoBinding(binding?: string | null): boolean {
  return binding === "minecraft_logo";
}
