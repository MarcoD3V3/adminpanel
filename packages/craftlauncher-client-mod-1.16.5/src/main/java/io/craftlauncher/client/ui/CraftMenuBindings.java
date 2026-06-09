package io.craftlauncher.client.ui;

import net.minecraft.util.SharedConstants;
import net.minecraftforge.fml.ModList;

/**
 * Resuelve textos dinámicos del menú principal (Forge, logo, mods…).
 * Alineado con {@code src/lib/game-menu-bindings.ts} del Hub Builder.
 */
public final class CraftMenuBindings {
    private CraftMenuBindings() {}

    public static String resolve(String binding) {
        if (binding == null || binding.isEmpty()) return null;
        switch (binding) {
            case "minecraft_logo":
                return "MINECRAFT";
            case "java_edition":
                return "Java Edition";
            case "forge_version":
                return "Forge " + forgeVersion();
            case "minecraft_version":
                return "Minecraft " + minecraftVersion();
            case "mcp_version":
                return "MCP " + mcpVersion(minecraftVersion());
            case "mods_loaded":
                return modsLoadedLine();
            case "forge_update":
                return forgeUpdateLine(minecraftVersion());
            default:
                return null;
        }
    }

    public static boolean isLogoBinding(String binding) {
        return "minecraft_logo".equals(binding);
    }

    private static String forgeVersion() {
        try {
            return ModList.get().getModContainerById("forge")
                    .map(c -> c.getModInfo().getVersion().toString())
                    .orElse("?.?.?");
        } catch (Throwable ignored) {
            return "?.?.?";
        }
    }

    private static String minecraftVersion() {
        try {
            return SharedConstants.getVersion().getName();
        } catch (Throwable ignored) {
            return "?";
        }
    }

    private static String mcpVersion(String mc) {
        switch (mc) {
            case "1.16.5": return "20210115.111550";
            case "1.18.2": return "20220404.173914";
            case "1.19.2": return "20220608.095529";
            case "1.20.1": return "20230612.114412";
            case "1.21.1": return "20240808.132146";
            default: return "—";
        }
    }

    private static String modsLoadedLine() {
        try {
            long count = ModList.get().getMods().stream()
                    .filter(m -> {
                        String id = m.getModId();
                        return id != null && !"minecraft".equals(id) && !"forge".equals(id) && !"fml".equals(id);
                    })
                    .count();
            return count + (count == 1 ? " mod loaded" : " mods loaded");
        } catch (Throwable ignored) {
            return "0 mods loaded";
        }
    }

    private static String forgeUpdateLine(String mc) {
        String next = forgeUpdateHint(mc);
        return next.isEmpty() ? "" : "New Forge version available: " + next;
    }

    private static String forgeUpdateHint(String mc) {
        switch (mc) {
            case "1.16.5": return "36.2.42";
            case "1.18.2": return "40.3.0";
            case "1.19.2": return "43.3.0";
            case "1.20.1": return "47.3.0";
            default: return "";
        }
    }

    public static float textScaleFor(String binding) {
        return isLogoBinding(binding) ? 2.4f : 1f;
    }

    public static boolean leftAlignFor(String binding) {
        if (binding == null) return false;
        switch (binding) {
            case "forge_version":
            case "minecraft_version":
            case "mcp_version":
            case "mods_loaded":
            case "forge_update":
                return true;
            default:
                return false;
        }
    }
}
