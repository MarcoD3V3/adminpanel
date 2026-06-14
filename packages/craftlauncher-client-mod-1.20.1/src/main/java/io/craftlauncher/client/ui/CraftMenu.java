package io.craftlauncher.client.ui;

import java.io.File;
import java.io.FileReader;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.minecraft.Util;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.OptionsScreen;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.client.gui.screens.ConnectScreen;
import net.minecraft.client.gui.screens.multiplayer.JoinMultiplayerScreen;
import net.minecraft.client.gui.screens.worldselection.SelectWorldScreen;
import net.minecraft.client.multiplayer.ServerData;
import net.minecraft.client.multiplayer.resolver.ServerAddress;
import io.craftlauncher.loading.mixin.ScreenAccessor;
import net.minecraft.network.chat.Component;
import net.minecraftforge.client.gui.ModListScreen;
import net.minecraftforge.fml.loading.FMLPaths;

public final class CraftMenu {
    private CraftMenu() {}

    private static final float DEFAULT_DESIGN_W = 480f;
    private static final float DEFAULT_DESIGN_H = 270f;

    private static long lastModified = Long.MIN_VALUE;
    private static boolean hideVanillaDecor = true;

    public static boolean hideVanillaDecor() {
        return hideVanillaDecor;
    }

    private static File configFile() {
        return FMLPaths.CONFIGDIR.get().resolve("craftlauncher-ui.json").toFile();
    }

    public static void build(TitleScreen screen) {
        ScreenAccessor access = (ScreenAccessor) screen;
        Minecraft mc = access.craftlauncher$getMinecraft();
        File cfg = configFile();
        lastModified = cfg.exists() ? cfg.lastModified() : -1L;

        int gw = screen.width;
        int gh = screen.height;
        JsonObject root = readJson(cfg);
        hideVanillaDecor = root == null || !root.has("hideVanillaDecor") || root.get("hideVanillaDecor").getAsBoolean();
        float designW = designWidth(root);
        float designH = designHeight(root);

        access.craftlauncher$getChildren().clear();
        access.craftlauncher$getRenderables().clear();

        if (root != null && root.has("elements")) {
            JsonArray els = root.getAsJsonArray("elements");
            for (JsonElement e : els) {
                if (!e.isJsonObject()) continue;
                JsonObject o = e.getAsJsonObject();
                String type = getString(o, "type", "button");

                int w = scaleDesignX(getInt(o, "w", 160), gw, designW);
                int h = scaleDesignY(getInt(o, "h", 20), gh, designH);
                int x = resolveAnchorX(o, gw, w, designW);
                int y = resolveAnchorY(o, gh, h, designH);

                int bg = parseColor(getString(o, "bg", "#cc2b2e33"), 0xCC2B2E33);
                int bgHover = parseColor(getString(o, "bgHover", "#ff3a3e45"), 0xFF3A3E45);
                int border = parseColor(getString(o, "border", "#ff5b5f66"), 0xFF5B5F66);
                int textColor = parseColor(getString(o, "textColor", "#ffe8eaed"), 0xFFE8EAED);

                String binding = getString(o, "binding", null);
                String labelText = resolveElementText(o, binding);
                if ("label".equals(type)) {
                    if (labelText == null || labelText.isEmpty()) continue;
                    boolean leftAlign = CraftMenuBindings.leftAlignFor(binding) || binding == null || binding.isEmpty();
                    CraftButton lbl = new CraftButton(x, y, w, h,
                            Component.literal(labelText), b -> {},
                            0, 0, 0, textColor, false,
                            CraftMenuBindings.textScaleFor(binding),
                            leftAlign);
                    lbl.active = false;
                    addToScreen(access, lbl, false);
                    continue;
                }

                CraftButton b = new CraftButton(x, y, w, h,
                        Component.literal(labelText != null ? labelText : getString(o, "text", "")),
                        makeAction(o, screen, mc),
                        bg, bgHover, border, textColor, true,
                        CraftMenuBindings.textScaleFor(binding),
                        CraftMenuBindings.leftAlignFor(binding));
                addToScreen(access, b, true);
            }
        }

    }

    /** Render + clics: addRenderableOnly no registra eventos de ratón. */
    private static void addToScreen(ScreenAccessor access, CraftButton widget, boolean clickable) {
        if (clickable) {
            access.craftlauncher$getChildren().add(widget);
        }
        access.craftlauncher$addRenderableOnly(widget);
    }

    private static String resolveElementText(JsonObject o, String binding) {
        if (binding != null && !binding.isEmpty()) {
            String resolved = CraftMenuBindings.resolve(binding);
            if (resolved != null) return resolved;
        }
        return getString(o, "text", "");
    }

    public static void tick(TitleScreen screen) {
        ScreenAccessor access = (ScreenAccessor) screen;
        Minecraft mc = access.craftlauncher$getMinecraft();
        File cfg = configFile();
        long m = cfg.exists() ? cfg.lastModified() : -1L;
        if (m != lastModified) {
            lastModified = m;
            mc.setScreen(new TitleScreen());
        }
    }

    private static float designWidth(JsonObject root) {
        if (root != null && root.has("designWidth")) {
            try {
                return Math.max(1f, root.get("designWidth").getAsFloat());
            } catch (Throwable ignored) {
            }
        }
        return DEFAULT_DESIGN_W;
    }

    private static float designHeight(JsonObject root) {
        if (root != null && root.has("designHeight")) {
            try {
                return Math.max(1f, root.get("designHeight").getAsFloat());
            } catch (Throwable ignored) {
            }
        }
        return DEFAULT_DESIGN_H;
    }

    private static int scaleDesignX(int px, int gw, float designW) {
        return Math.round(px * gw / designW);
    }

    private static int scaleDesignY(int px, int gh, float designH) {
        return Math.round(px * gh / designH);
    }

    private static int resolveAnchorX(JsonObject o, int gw, int w, float designW) {
        JsonElement xe = o.get("x");
        if (xe != null && xe.isJsonPrimitive() && xe.getAsJsonPrimitive().isNumber()) {
            return scaleDesignX(xe.getAsInt(), gw, designW);
        }

        String ax = getString(o, "anchorX", null);
        int off = getInt(o, "offsetX", Integer.MIN_VALUE);
        if (ax == null) {
            if (xe != null && xe.isJsonPrimitive()) {
                String v = xe.getAsString();
                if ("left".equals(v)) return scaleDesignX(8, gw, designW);
                if ("right".equals(v)) return gw - w - scaleDesignX(8, gw, designW);
                return gw / 2 - w / 2;
            }
            return gw / 2 - w / 2;
        }
        if (off == Integer.MIN_VALUE) off = 0;
        switch (ax) {
            case "left": return scaleDesignX(off, gw, designW);
            case "right": return gw - w - scaleDesignX(off, gw, designW);
            default: return gw / 2 - w / 2 + scaleDesignX(off, gw, designW);
        }
    }

    private static int resolveAnchorY(JsonObject o, int gh, int h, float designH) {
        JsonElement ye = o.get("y");
        if (ye != null && ye.isJsonPrimitive() && ye.getAsJsonPrimitive().isNumber()) {
            return scaleDesignY(ye.getAsInt(), gh, designH);
        }

        String ay = getString(o, "anchorY", null);
        int off = getInt(o, "offsetY", Integer.MIN_VALUE);
        if (ay == null) {
            if (ye != null && ye.isJsonPrimitive()) {
                if ("center".equals(ye.getAsString())) return gh / 2 - h / 2;
            }
            return scaleDesignY(40, gh, designH);
        }
        if (off == Integer.MIN_VALUE) off = 0;
        switch (ay) {
            case "top": return scaleDesignY(off, gh, designH);
            case "bottom": return gh - h - scaleDesignY(off, gh, designH);
            default: return gh / 2 - h / 2 + scaleDesignY(off, gh, designH);
        }
    }

    private static Button.OnPress makeAction(JsonObject o, TitleScreen screen, Minecraft mc) {
        String action = getString(o, "action", "");
        String url = getString(o, "url", "");
        String server = getString(o, "server", "").trim();
        String label = getString(o, "text", "CraftLauncher");
        switch (action) {
            case "singleplayer": return b -> mc.setScreen(new SelectWorldScreen(screen));
            case "multiplayer": return b -> mc.setScreen(new JoinMultiplayerScreen(screen));
            case "join_server":
                if (server.isEmpty()) return b -> {};
                return b -> {
                    ServerData data = new ServerData(label, server, false);
                    ConnectScreen.startConnecting(screen, mc, ServerAddress.parseString(server), data, false);
                };
            case "options": return b -> mc.setScreen(new OptionsScreen(screen, mc.options));
            case "mods": return b -> mc.setScreen(new ModListScreen(screen));
            case "quit": return b -> mc.stop();
            case "url": return b -> Util.getPlatform().openUri(url);
            default: return b -> {};
        }
    }

    private static int parseColor(String hex, int fallback) {
        if (hex == null) return fallback;
        String s = hex.trim();
        if (s.startsWith("#")) s = s.substring(1);
        try {
            if (s.length() == 6) return 0xFF000000 | (int) Long.parseLong(s, 16);
            if (s.length() == 8) return (int) Long.parseLong(s, 16);
        } catch (NumberFormatException ignored) {
        }
        return fallback;
    }

    private static JsonObject readJson(File f) {
        if (f == null || !f.exists()) return null;
        try (FileReader r = new FileReader(f)) {
            JsonElement el = JsonParser.parseReader(r);
            return el.isJsonObject() ? el.getAsJsonObject() : null;
        } catch (Throwable t) {
            return null;
        }
    }

    private static String getString(JsonObject o, String k, String d) {
        try {
            return o.has(k) && !o.get(k).isJsonNull() ? o.get(k).getAsString() : d;
        } catch (Throwable t) {
            return d;
        }
    }

    private static int getInt(JsonObject o, String k, int d) {
        try {
            return o.has(k) && !o.get(k).isJsonNull() ? o.get(k).getAsInt() : d;
        } catch (Throwable t) {
            return d;
        }
    }

}
