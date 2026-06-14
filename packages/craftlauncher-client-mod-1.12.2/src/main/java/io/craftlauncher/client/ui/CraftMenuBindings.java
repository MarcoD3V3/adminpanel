package io.craftlauncher.client.ui;

import net.minecraftforge.fml.common.Loader;
import net.minecraftforge.fml.common.ModContainer;

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
            ModContainer forge = Loader.instance().getIndexedModList().get("forge");
            return forge != null ? forge.getVersion() : "?.?.?";
        } catch (Throwable ignored) {
            return "?.?.?";
        }
    }

    private static String minecraftVersion() {
        try {
            return Loader.MC_VERSION;
        } catch (Throwable ignored) {
            return "?";
        }
    }

    private static String mcpVersion(String mc) {
        switch (mc) {
            case "1.12.2": return "9.40";
            case "1.16.5": return "20210115.111550";
            default: return "—";
        }
    }

    private static String modsLoadedLine() {
        try {
            long count = Loader.instance().getActiveModList().stream()
                    .filter(m -> {
                        String id = m.getModId();
                        return id != null && !"minecraft".equals(id) && !"forge".equals(id) && !"FML".equals(id);
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
            case "1.12.2": return "14.23.5.2865";
            case "1.16.5": return "36.2.42";
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
