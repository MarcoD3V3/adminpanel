package io.craftlauncher.client.ui;

import java.io.File;
import java.io.FileReader;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import io.craftlauncher.loading.mixin.ScreenAccessor;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screen.MainMenuScreen;
import net.minecraft.client.gui.screen.ConnectingScreen;
import net.minecraft.client.gui.screen.MultiplayerScreen;
import net.minecraft.client.multiplayer.ServerData;
import net.minecraft.client.gui.screen.OptionsScreen;
import net.minecraft.client.gui.screen.WorldSelectionScreen;
import net.minecraft.client.gui.widget.button.Button;
import net.minecraft.util.Util;
import net.minecraft.util.text.StringTextComponent;
import net.minecraftforge.fml.client.gui.screen.ModListScreen;
import net.minecraftforge.fml.loading.FMLPaths;

public final class CraftMenu {
    private CraftMenu() {}

    private static long lastModified = Long.MIN_VALUE;
    private static boolean hideVanillaDecor = true;

    public static boolean hideVanillaDecor() {
        return hideVanillaDecor;
    }

    private static File configFile() {
        return FMLPaths.CONFIGDIR.get().resolve("craftlauncher-ui.json").toFile();
    }

    public static void build(MainMenuScreen screen) {
        ScreenAccessor access = (ScreenAccessor) screen;
        Minecraft mc = access.craftlauncher$getMinecraft();

        access.craftlauncher$getButtons().clear();
        access.craftlauncher$getChildren().clear();

        File cfg = configFile();
        lastModified = cfg.exists() ? cfg.lastModified() : -1L;

        int gw = screen.width;
        int gh = screen.height;
        JsonObject root = readJson(cfg);
        hideVanillaDecor = root == null || !root.has("hideVanillaDecor") || root.get("hideVanillaDecor").getAsBoolean();
        Button anchor = null;

        if (root != null && root.has("elements")) {
            JsonArray els = root.getAsJsonArray("elements");
            for (JsonElement e : els) {
                if (!e.isJsonObject()) continue;
                JsonObject o = e.getAsJsonObject();
                String type = getString(o, "type", "button");

                int w = getInt(o, "w", 160);
                int h = getInt(o, "h", 20);
                int x = resolveAnchorX(o, gw, w);
                int y = resolveAnchorY(o, gh, h);

                int bg = parseColor(getString(o, "bg", "#cc2b2e33"), 0xCC2B2E33);
                int bgHover = parseColor(getString(o, "bgHover", "#ff3a3e45"), 0xFF3A3E45);
                int border = parseColor(getString(o, "border", "#ff5b5f66"), 0xFF5B5F66);
                int textColor = parseColor(getString(o, "textColor", "#ffe8eaed"), 0xFFE8EAED);

                String binding = getString(o, "binding", null);
                String labelText = resolveElementText(o, binding);
                if ("label".equals(type)) {
                    if (labelText == null || labelText.isEmpty()) continue;
                    CraftButton lbl = new CraftButton(x, y, w, h,
                            new StringTextComponent(labelText), b -> {},
                            0, 0, 0, textColor, false,
                            CraftMenuBindings.textScaleFor(binding),
                            CraftMenuBindings.leftAlignFor(binding));
                    lbl.active = false;
                    access.craftlauncher$addButton(lbl);
                    continue;
                }

                CraftButton b = new CraftButton(x, y, w, h,
                        new StringTextComponent(labelText != null ? labelText : getString(o, "text", "")),
                        makeAction(o, screen, mc),
                        bg, bgHover, border, textColor, true,
                        CraftMenuBindings.textScaleFor(binding),
                        CraftMenuBindings.leftAlignFor(binding));
                access.craftlauncher$addButton(b);
                if (anchor == null) anchor = b;
            }
        }
    }

    private static String resolveElementText(JsonObject o, String binding) {
        if (binding != null && !binding.isEmpty()) {
            String resolved = CraftMenuBindings.resolve(binding);
            if (resolved != null) return resolved;
        }
        return getString(o, "text", "");
    }

    public static void tick(MainMenuScreen screen) {
        ScreenAccessor access = (ScreenAccessor) screen;
        Minecraft mc = access.craftlauncher$getMinecraft();
        File cfg = configFile();
        long m = cfg.exists() ? cfg.lastModified() : -1L;
        if (m != lastModified) {
            lastModified = m;
            mc.displayGuiScreen(new MainMenuScreen());
        }
    }

    private static int resolveAnchorX(JsonObject o, int gw, int w) {
        String ax = getString(o, "anchorX", null);
        int off = getInt(o, "offsetX", Integer.MIN_VALUE);
        if (ax == null) {
            JsonElement xe = o.get("x");
            if (xe != null && xe.isJsonPrimitive()) {
                if (xe.getAsJsonPrimitive().isNumber()) return xe.getAsInt();
                String v = xe.getAsString();
                if ("left".equals(v)) return 8;
                if ("right".equals(v)) return gw - w - 8;
                return gw / 2 - w / 2;
            }
            return gw / 2 - w / 2;
        }
        if (off == Integer.MIN_VALUE) off = 0;
        switch (ax) {
            case "left": return off;
            case "right": return gw - w - off;
            default: return gw / 2 - w / 2 + off;
        }
    }

    private static int resolveAnchorY(JsonObject o, int gh, int h) {
        String ay = getString(o, "anchorY", null);
        int off = getInt(o, "offsetY", Integer.MIN_VALUE);
        if (ay == null) {
            JsonElement ye = o.get("y");
            if (ye != null && ye.isJsonPrimitive()) {
                if (ye.getAsJsonPrimitive().isNumber()) return ye.getAsInt();
                if ("center".equals(ye.getAsString())) return gh / 2 - h / 2;
            }
            return 40;
        }
        if (off == Integer.MIN_VALUE) off = 0;
        switch (ay) {
            case "top": return off;
            case "bottom": return gh - h - off;
            default: return gh / 2 - h / 2 + off;
        }
    }

    private static Button.IPressable makeAction(JsonObject o, MainMenuScreen screen, Minecraft mc) {
        String action = getString(o, "action", "");
        String url = getString(o, "url", "");
        String server = getString(o, "server", "").trim();
        switch (action) {
            case "singleplayer": return b -> mc.displayGuiScreen(new WorldSelectionScreen(screen));
            case "multiplayer": return b -> mc.displayGuiScreen(new MultiplayerScreen(screen));
            case "join_server":
                if (server.isEmpty()) return b -> {};
                return b -> {
                    String label = getString(o, "text", "CraftLauncher");
                    ServerData data = new ServerData(label, server, false);
                    mc.displayGuiScreen(new ConnectingScreen(screen, mc, data));
                };
            case "options": return b -> mc.displayGuiScreen(new OptionsScreen(screen, mc.gameSettings));
            case "mods": return b -> mc.displayGuiScreen(new ModListScreen(screen));
            case "quit": return b -> mc.shutdownMinecraftApplet();
            case "url": return b -> Util.getOSType().openURI(url);
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
            JsonElement el = new JsonParser().parse(r);
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
